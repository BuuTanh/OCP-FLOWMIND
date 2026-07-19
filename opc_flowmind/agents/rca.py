from agents.base_agent import BaseAgent
from models.risk import RiskAssessment, RiskAlert
from models.financial import FinancialProposal
from data import loader
from data.masking import mask_payload_for_openai
from openai_engine.prompts import RCA_SYSTEM, RCA_USER_TEMPLATE
from config import (CASH_RESERVE_MINIMUM, TARGET_GROSS_MARGIN,
                    HUMAN_APPROVAL_THRESHOLD, TRANSACTION_RISK_CRITICAL,
                    CONFIDENCE_THRESHOLD)
import json, re

class RiskComplianceAgent(BaseAgent):
    name = "Risk & Compliance Agent"
    task_id = "TASK-002"

    def run(self, context: dict) -> dict:
        financial: FinancialProposal = context["financial_proposal"]
        contract_id = financial.target_contract_id
        trace_id = context.get("trace_id", "")

        bank_txn       = loader.get_bank_txn()
        orders         = loader.get_orders()
        all_credit     = loader.get_credit_profile()
        pre_alerts_raw = loader.get_alerts()   # 14_ALERTS từ Google Sheets
        resolved_items: list[str] = context.get("resolved_items", [])

        # ── Filter credit profiles cho contract này ──────────────────────
        def _cr_for_contract(cr: dict) -> bool:
            basis = cr.get("collateral_or_basis", "")
            linked = re.findall(r'CON-\d+', basis)
            return (not linked) or (contract_id in linked)

        credit = [c for c in all_credit if _cr_for_contract(c)]

        # ── Merge pre-existing alerts từ 14_ALERTS ───────────────────────
        # Chỉ lấy alerts không gắn contract cụ thể, hoặc đúng contract đang xét
        def _pre_alert_relevant(row: dict) -> bool:
            related = row.get("related_record", "")
            linked = re.findall(r'CON-\d+', related)
            return (not linked) or (contract_id in linked)

        pre_alerts: list[RiskAlert] = []
        for i, row in enumerate(pre_alerts_raw):
            if not row.get("alert_id") or not _pre_alert_relevant(row):
                continue
            sev = row.get("severity", "Medium")
            if sev not in ("Critical", "High", "Medium", "Low"):
                sev = "Medium"
            try:
                score = float(str(row.get("risk_score", "50")).replace(",", "."))
            except (ValueError, TypeError):
                score = 50.0
            pre_alerts.append(RiskAlert(
                alert_id=row.get("alert_id", f"AL-PRE-{i}"),
                rule_id="14_ALERTS",
                related_record=row.get("related_record", ""),
                severity=sev,
                risk_score=score,
                description=row.get("description", ""),
                recommended_action=row.get("recommended_action", ""),
                requires_human_approval=(sev == "Critical"),
            ))

        # ── Dynamic alerts từ rules ───────────────────────────────────────
        alerts: list[RiskAlert] = []
        required_approvals: list[str] = []

        def _is_resolved(record_id: str) -> bool:
            """Kiểm tra xem record này đã được founder xác nhận xử lý chưa."""
            return any(r in record_id or record_id in r for r in resolved_items)

        # RR-001: Suspicious TXN (company-wide)
        for txn in bank_txn:
            score = float(txn.get("transaction_risk_score", 0))
            if score >= TRANSACTION_RISK_CRITICAL:
                if _is_resolved(txn["txn_id"]):
                    continue   # Founder đã xác nhận xử lý TXN này
                alerts.append(RiskAlert(
                    alert_id=f"AL-TXN-{txn['txn_id']}",
                    rule_id="RR-001",
                    related_record=txn["txn_id"],
                    severity="Critical",
                    risk_score=score,
                    description=f"Suspicious TXN {txn['txn_id']}: {txn.get('description','')} risk={score}",
                    recommended_action="Hold immediately + founder confirmation required (API-H-003)",
                    requires_human_approval=True
                ))
                required_approvals.append(f"HOLD_{txn['txn_id']}_founder_confirm")

        # RR-002: Cashflow below reserve minimum
        for gap in financial.monthly_gaps:
            if gap.projected_closing_cash < CASH_RESERVE_MINIMUM:
                alerts.append(RiskAlert(
                    alert_id=f"AL-CASH-{gap.month}",
                    rule_id="RR-002",
                    related_record=f"CASHFLOW_{gap.month}",
                    severity="High",
                    risk_score=76,
                    description=f"Tháng {gap.month}: closing cash {gap.projected_closing_cash:,.0f} dưới mức tối thiểu 550M",
                    recommended_action="Xem xét working capital hoặc giãn tiến độ giao hàng",
                    requires_human_approval=False
                ))

        # RR-003: Margin below target
        if not financial.gross_margin_ok:
            alerts.append(RiskAlert(
                alert_id="AL-MARGIN-001",
                rule_id="RR-003",
                related_record=contract_id,
                severity="Medium",
                risk_score=55,
                description=f"Gross margin {financial.gross_margin_actual:.0%} < target {TARGET_GROSS_MARGIN:.0%}",
                recommended_action="Review giá hoặc cắt giảm chi phí",
                requires_human_approval=False
            ))

        # RR-005: Large credit request requires founder approval
        for cr in credit:
            amount = float(cr.get("requested_amount", 0))
            if amount > HUMAN_APPROVAL_THRESHOLD:
                alerts.append(RiskAlert(
                    alert_id=f"AL-LARGE-{cr['credit_case_id']}",
                    rule_id="RR-005",
                    related_record=cr["credit_case_id"],
                    severity="High",
                    risk_score=80,
                    description=f"{cr['credit_case_id']}: requested {amount:,.0f} VND > 300M threshold",
                    recommended_action="Bắt buộc founder ký duyệt trước khi submit",
                    requires_human_approval=True
                ))
                required_approvals.append(f"APPROVE_{cr['credit_case_id']}_before_submission")

        # RR-006: hồ sơ tín dụng dưới ngưỡng điểm tin cậy 0.65 (mục 4.3 báo cáo)
        for cr in credit:
            try:
                score = float(str(cr.get("eligibility_score", 0)).replace(",", "."))
            except (ValueError, TypeError):
                score = 0.0
            if score < CONFIDENCE_THRESHOLD:
                alerts.append(RiskAlert(
                    alert_id=f"AL-CONF-{cr['credit_case_id']}",
                    rule_id="RR-006",
                    related_record=cr["credit_case_id"],
                    severity="Medium",
                    risk_score=58,
                    description=f"{cr['credit_case_id']}: điểm tin cậy {score:.0%} dưới ngưỡng khuyến nghị 65%",
                    recommended_action="Yêu cầu bổ sung dữ liệu hoặc đánh giá lại điều kiện tín dụng",
                    requires_human_approval=False
                ))

        # DOC-CHECK: thiếu chứng từ — kiểm tra bổ trợ nội bộ, không thuộc 7 quy tắc RR-001..RR-007
        # chính thức của báo cáo (mục 4.3), nhưng vẫn cần cảnh báo cho founder.
        for cr in credit:
            if "Missing" in cr.get("precheck_note", "") or cr.get("approval_status") == "Review":
                alerts.append(RiskAlert(
                    alert_id=f"AL-DOC-{cr['credit_case_id']}",
                    rule_id="DOC-CHECK",
                    related_record=cr["credit_case_id"],
                    severity="Medium",
                    risk_score=55,
                    description=f"Thiếu chứng từ cho {cr['credit_case_id']}: {cr.get('precheck_note','')}",
                    recommended_action="Yêu cầu bổ sung chứng từ",
                    requires_human_approval=False
                ))

        # RR-007: Delivery delay — chỉ orders thuộc contract này
        for order in orders:
            if order.get("contract_id") == contract_id and order.get("status") == "At risk":
                alerts.append(RiskAlert(
                    alert_id=f"AL-DEL-{order['order_id']}",
                    rule_id="RR-007",
                    related_record=order["order_id"],
                    severity="High",
                    risk_score=72,
                    description=f"{order['order_id']} (thuộc {contract_id}): {order.get('delivery_note','')}",
                    recommended_action="Escalate kế hoạch vận hành, kiểm tra nhà thầu",
                    requires_human_approval=False
                ))

        # ── Merge pre-existing + dynamic; deduplicate by alert_id ────────
        existing_ids = {a.alert_id for a in alerts}
        for pa in pre_alerts:
            # Bỏ qua nếu founder đã xác nhận xử lý alert này
            if _is_resolved(pa.alert_id) or _is_resolved(pa.related_record):
                continue
            if pa.alert_id not in existing_ids:
                alerts.append(pa)
                existing_ids.add(pa.alert_id)
                if pa.requires_human_approval:
                    required_approvals.append(f"RESOLVE_{pa.alert_id}")

        # ── Severity summary ─────────────────────────────────────────────
        severities = [a.severity for a in alerts]
        if "Critical" in severities:
            overall, pipeline_ok = "Critical", False
        elif "High" in severities:
            overall, pipeline_ok = "High", True
        elif "Medium" in severities:
            overall, pipeline_ok = "Medium", True
        else:
            overall, pipeline_ok = "OK", True

        # ── OpenAI call ──────────────────────────────────────────────────
        existing_alerts_masked = mask_payload_for_openai(
            {"alerts": [{"id": a.alert_id, "severity": a.severity, "desc": a.description} for a in alerts]}
        )
        credit_masked = mask_payload_for_openai(
            {"credit": [{"id": c["credit_case_id"], "type": c["request_type"],
                         "note": c["precheck_note"], "status": c["approval_status"]}
                        for c in credit]}
        )
        user_prompt = RCA_USER_TEMPLATE.format(
            financial_summary=financial.narrative[:400],
            suspicious_txns=financial.suspicious_txn_ids or "None",
            existing_alerts=json.dumps(existing_alerts_masked, ensure_ascii=False),
            alert_count=len(alerts),
            contract_id=contract_id,
            needs_bond="Yes (CR-002, 420M)" if any("performance" in fn.need_type for fn in financial.funding_needs) else "No",
            doc_status=json.dumps(credit_masked, ensure_ascii=False)
        )
        narrative, call_id, prompt_hash = self.safe_openai_call(RCA_SYSTEM, user_prompt)

        blocked_by = None
        if not pipeline_ok:
            blocked_by = f"Critical alerts: {[a.alert_id for a in alerts if a.severity=='Critical']}"

        result = RiskAssessment(
            overall_risk_level=overall,
            alerts=alerts,
            pipeline_should_continue=pipeline_ok,
            required_human_approvals=required_approvals,
            narrative=narrative,
            blocked_by=blocked_by
        )

        agent_log = self.log(
            input_source=["08_BANK_TXN", "13_RISK_RULES", "14_ALERTS", "10_CREDIT_PROFILE"],
            output_summary=f"overall={overall} alerts={len(alerts)} (dynamic={len(alerts)-len(pre_alerts)} pre={len(pre_alerts)}) pipeline_ok={pipeline_ok}",
            openai_call_id=call_id,
            masked_fields=["txn_id", "credit_case_id", "customer_id"],
            human_approval_required=len(required_approvals) > 0,
            pipeline_status="completed" if pipeline_ok else "blocked",
            trace_id=trace_id,
            prompt_hash=prompt_hash
        )

        return {"output": result, "log": agent_log}
