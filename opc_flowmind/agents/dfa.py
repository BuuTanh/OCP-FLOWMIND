from agents.base_agent import BaseAgent
from models.financial import FinancialProposal, MonthlyGap, FundingNeed
from data import loader
from data.masking import mask_payload_for_openai, mask_amount
from openai_engine.prompts import DFA_SYSTEM, DFA_USER_TEMPLATE
from openai_engine.validator import validate_financial_narrative
from config import CASH_RESERVE_MINIMUM, TARGET_GROSS_MARGIN, TARGET_CONTRACT_ID, TRANSACTION_RISK_CRITICAL
import json

class DataFinanceAgent(BaseAgent):
    name = "Data & Finance Agent"
    task_id = "TASK-001"

    def run(self, context: dict) -> dict:
        contract_id = context.get("contract_id", TARGET_CONTRACT_ID)

        cashflow  = loader.get_cashflow()
        contracts = loader.get_contracts()
        invoices  = loader.get_invoices()
        bank_txn  = loader.get_bank_txn()

        target_contract = next((c for c in contracts if c["contract_id"] == contract_id), {})
        gross_margin = float(target_contract.get("gross_margin", 0))

        monthly_gaps = []
        total_gap_negative = 0.0
        for row in cashflow:
            closing = float(row.get("projected_closing_cash", 0))
            gap = closing - CASH_RESERVE_MINIMUM
            if closing < 0:
                total_gap_negative += abs(closing)
            status = "CRITICAL" if closing < 0 else ("WARNING" if gap < 0 else "OK")
            monthly_gaps.append(MonthlyGap(
                month=row["month"],
                expected_cash_in=float(row.get("expected_cash_in", 0)),
                expected_cash_out=float(row.get("expected_cash_out", 0)),
                projected_closing_cash=closing,
                vs_reserve_minimum=gap,
                status=status
            ))

        # Map order_id → contract_id để lọc invoice theo hợp đồng đang phân tích
        orders_data = loader.get_orders()
        order_to_contract = {o["order_id"]: o.get("contract_id", "") for o in orders_data}

        receivable_open = sum(
            float(inv.get("invoice_amount", 0))
            for inv in invoices
            if inv.get("status") == "Open"
            and order_to_contract.get(inv.get("order_id", "")) == contract_id
        )
        receivable_pipeline = sum(
            float(inv.get("invoice_amount", 0))
            for inv in invoices
            if inv.get("status") == "Not issued"
            and order_to_contract.get(inv.get("order_id", "")) == contract_id
        )

        suspicious_txns = [
            t["txn_id"] for t in bank_txn
            if float(t.get("transaction_risk_score", 0)) >= TRANSACTION_RISK_CRITICAL
        ]

        funding_needs = []
        if total_gap_negative > 0:
            funding_needs.append(FundingNeed(
                need_type="working_capital",
                estimated_amount=total_gap_negative,
                urgency="immediate",
                linked_contract=contract_id
            ))
        if "performance bond" in target_contract.get("payment_terms", "").lower():
            # Đọc số tiền performance bond từ credit profile thay vì hardcode
            credit_data = loader.get_credit_profile()
            bond_amount = next(
                (float(c.get("requested_amount", 420_000_000))
                 for c in credit_data if "performance bond" in c.get("request_type", "").lower()),
                420_000_000
            )
            funding_needs.append(FundingNeed(
                need_type="performance_bond",
                estimated_amount=bond_amount,
                urgency="within_30d",
                linked_contract=contract_id
            ))

        cashflow_summary_masked = mask_payload_for_openai({
            "months": [
                {"month": g.month, "closing": g.projected_closing_cash, "status": g.status}
                for g in monthly_gaps
            ]
        })
        user_prompt = DFA_USER_TEMPLATE.format(
            contract_id=contract_id,
            contract_value_band=mask_amount(float(target_contract.get("contract_value", 0))),
            gross_margin=gross_margin,
            contract_status=target_contract.get("status", ""),
            cashflow_summary=json.dumps(cashflow_summary_masked, ensure_ascii=False),
            receivables_open_band=mask_amount(receivable_open),
            receivables_pipeline_band=mask_amount(receivable_pipeline),
            suspicious_txns=suspicious_txns or "None"
        )
        narrative, call_id = self.safe_openai_call(DFA_SYSTEM, user_prompt)

        check = validate_financial_narrative(narrative, cashflow)
        if not check["ok"]:
            narrative += f"\n[SYSTEM WARNING: back-check flags: {check['flags']}]"

        result = FinancialProposal(
            target_contract_id=contract_id,
            gross_margin_actual=gross_margin,
            gross_margin_ok=(gross_margin >= TARGET_GROSS_MARGIN),
            receivable_total_open=receivable_open,
            receivable_total_pipeline=receivable_pipeline,
            monthly_gaps=monthly_gaps,
            total_funding_gap_3m=total_gap_negative,
            funding_needs=funding_needs,
            suspicious_txn_ids=suspicious_txns,
            missing_data_fields=[],
            narrative=narrative,
            data_confidence="Verified"
        )

        agent_log = self.log(
            input_source=["09_CASHFLOW", "04_CONTRACTS", "07_INVOICES", "08_BANK_TXN"],
            output_summary=f"gap_3m={total_gap_negative:,.0f} margin={gross_margin} suspicious={suspicious_txns}",
            openai_call_id=call_id,
            masked_fields=["contract_value", "invoice_amount", "amount"],
            human_approval_required=False,
            pipeline_status="completed"
        )

        return {"output": result, "log": agent_log}
