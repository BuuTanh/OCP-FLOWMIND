from agents.base_agent import BaseAgent
from models.decision import DecisionCard, BankOption
from models.financial import FinancialProposal
from models.risk import RiskAssessment
from data import loader
from data.masking import mask_payload_for_openai, mask_amount
from openai_engine.prompts import DPA_SYSTEM, DPA_USER_TEMPLATE
from openai_engine.validator import validate_recommendation
from config import CONFIDENCE_THRESHOLD
import json, re

class DecisionPartnerAgent(BaseAgent):
    name = "Decision & Partner Agent"
    task_id = "TASK-003"

    def _calc_confidence(self, credit_case: dict, doc_complete: bool) -> float:
        base = float(credit_case.get("eligibility_score", 0))
        completeness = 1.0 if doc_complete else 0.5
        return round(base * completeness, 2)

    def run(self, context: dict) -> dict:
        financial: FinancialProposal = context["financial_proposal"]
        risk: RiskAssessment         = context["risk_assessment"]
        contract_id = financial.target_contract_id
        crisis_resolved: bool        = context.get("crisis_resolved", False)
        resolved_items: list[str]    = context.get("resolved_items", [])

        credit_profiles = loader.get_credit_profile()
        bank_products   = loader.get_bank_products()
        contracts       = loader.get_contracts()
        customers       = loader.get_customers()

        target_contract = next((c for c in contracts if c["contract_id"] == contract_id), {})
        cus_id = target_contract.get("customer_id", "")
        target_customer = next((c for c in customers if c["customer_id"] == cus_id), {})
        customer_type = target_customer.get("customer_type", "")

        # Lọc credit profiles phù hợp với hợp đồng đang phân tích:
        # - CR có đề cập contract_id cụ thể → chỉ dùng khi đúng contract
        # - CR không đề cập contract cụ thể (general) → dùng cho tất cả
        def _cr_relevant(cr: dict) -> bool:
            basis = cr.get("collateral_or_basis", "")
            linked = re.findall(r'CON-\d+', basis)
            return (not linked) or (contract_id in linked)

        relevant_credit_profiles = [cr for cr in credit_profiles if _cr_relevant(cr)]

        bank_options: list[BankOption] = []
        blocked_cases: list[str] = []

        for cr in relevant_credit_profiles:
            doc_complete = "Missing" not in cr.get("precheck_note", "")
            confidence = self._calc_confidence(cr, doc_complete)

            if confidence < CONFIDENCE_THRESHOLD or not doc_complete:
                blocked_cases.append(cr["credit_case_id"])
                continue

            req_type = cr.get("request_type", "")
            amount   = float(cr.get("requested_amount", 0))

            matched_product = None
            if "performance bond" in req_type.lower():
                matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-002"), None)
            elif "working capital" in req_type.lower() and "micro" not in req_type.lower():
                if amount > 500_000_000 or customer_type not in ("Cooperative", "Household"):
                    matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-004"), None)
                else:
                    matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-006"), None)
            elif "micro" in req_type.lower():
                matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-006"), None)
            elif "trade finance" in req_type.lower():
                matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-003"), None)

            if matched_product:
                bank_options.append(BankOption(
                    bank=matched_product["bank"],
                    product_name=matched_product["product_name"],
                    product_id=matched_product["bank_product_id"],
                    credit_case_id=cr["credit_case_id"],
                    request_type=req_type,
                    amount_band=mask_amount(amount),
                    annual_rate=float(matched_product["annual_rate_or_fee"]) if matched_product.get("annual_rate_or_fee") else None,
                    eligibility_score=confidence,
                    fit_reason=matched_product.get("fit_note", ""),
                    requires_human_approval=True
                ))

        base_confidence = (
            round(sum(o.eligibility_score for o in bank_options) / len(bank_options), 2)
            if bank_options else 0.45
        )
        # Điều chỉnh confidence dựa trên trạng thái xử lý rủi ro hiện tại
        unresolved_critical = sum(
            1 for a in risk.alerts
            if a.severity == "Critical" and not any(
                r in a.related_record or a.related_record in r
                or r in a.alert_id or a.alert_id in r
                for r in resolved_items
            )
        )
        has_suspicious_txn = len(financial.suspicious_txn_ids) > 0
        adjustment = (
            - unresolved_critical * 0.04              # -4% mỗi Critical chưa xử lý
            + min(len(resolved_items), 5) * 0.015     # +1.5% mỗi mục đã xử lý, tối đa 5
            + (0.04 if crisis_resolved and has_suspicious_txn else 0)  # +4% chỉ khi có crisis thật và đã xử lý
        )
        overall_confidence = round(max(0.15, min(0.95, base_confidence + adjustment)), 2)

        # Khi founder đã xác nhận xử lý crisis (TXN), các TXN alert không còn block recommendation
        # Chỉ non-TXN critical alerts (nếu có) mới giữ has_critical=True
        if crisis_resolved:
            has_critical = any(
                a.severity == "Critical"
                for a in risk.alerts
                if "AL-TXN-" not in a.alert_id
            )
        else:
            has_critical = (risk.overall_risk_level == "Critical")
        margin_ok        = financial.gross_margin_ok
        gross_margin     = financial.gross_margin_actual
        funding_gap      = financial.total_funding_gap_3m
        contract_value   = float(target_contract.get("contract_value", 0))
        # Gap/Value ratio: nếu cần vay > 30% giá trị hợp đồng thì rủi ro cao
        gap_ratio        = (funding_gap / contract_value) if contract_value > 0 else 0

        if overall_confidence < CONFIDENCE_THRESHOLD and not bank_options:
            # Không đủ phương án tài chính và không đủ tin cậy
            recommendation = "CHUA_DU_DATA"
        elif gross_margin < 0.10:
            # Margin dưới 10%: ký lỗ — không có lý do kinh doanh để ký
            recommendation = "KHONG_KY"
        elif has_critical and not crisis_resolved and overall_confidence < CONFIDENCE_THRESHOLD:
            # Crisis chưa giải quyết + không đủ phương án tài chính → không ký
            recommendation = "KHONG_KY"
        elif gap_ratio > 0.5 and not bank_options:
            # Gap vốn > 50% giá trị hợp đồng mà không có phương án tài chính
            recommendation = "KHONG_KY"
        elif has_critical or not margin_ok or blocked_cases:
            # Có rủi ro cần giải quyết trước: crisis, margin thấp, hoặc hồ sơ chưa đủ
            recommendation = "KY_CO_DIEU_KIEN"
        elif margin_ok and bank_options and not has_critical:
            # Margin đạt, có phương án tài chính, không có rủi ro critical
            recommendation = "KY"
        else:
            recommendation = "KY_CO_DIEU_KIEN"

        preconditions = []
        if financial.suspicious_txn_ids:
            preconditions.append(f"Xử lý giao dịch đáng ngờ: {financial.suspicious_txn_ids}")
        if not margin_ok:
            preconditions.append(f"Review margin {financial.gross_margin_actual:.0%} → cần đạt ≥28%")
        if blocked_cases:
            preconditions.append(f"Bổ sung chứng từ cho: {blocked_cases}")
        preconditions.append(f"{contract_id} phải ký chính thức trước khi nộp hồ sơ ngân hàng")

        # Approval checklist tự sinh từ data thực — không hardcode
        approval_checklist = []

        # Từ suspicious TXN trong bank_txn
        for txn_id in financial.suspicious_txn_ids:
            approval_checklist.append(
                f"[ ] Founder xác nhận xử lý {txn_id} (RR-001 + API-H-003)"
            )

        # Từ credit cases vượt threshold 300M (chỉ các CR liên quan hợp đồng này)
        for cr in relevant_credit_profiles:
            amount = float(cr.get("requested_amount", 0))
            if amount > 300_000_000:
                approval_checklist.append(
                    f"[ ] Founder ký duyệt {cr['credit_case_id']} "
                    f"({amount/1e6:.0f}M > 300M, RR-005) — {cr.get('request_type','')}"
                )

        # Từ credit cases thiếu chứng từ (chỉ các CR liên quan hợp đồng này)
        for cr in relevant_credit_profiles:
            if "Missing" in cr.get("precheck_note", ""):
                approval_checklist.append(
                    f"[ ] Bổ sung chứng từ cho {cr['credit_case_id']}: {cr.get('precheck_note','')}"
                )

        # Từ orders at risk — chỉ orders thuộc contract đang phân tích
        at_risk_orders = loader.get_orders()
        for order in at_risk_orders:
            if order.get("contract_id") == contract_id and order.get("status") == "At risk":
                approval_checklist.append(
                    f"[ ] Xác nhận kế hoạch xử lý {order['order_id']}: {order.get('delivery_note','')}"
                )

        # Từ Critical pre-existing alerts (14_ALERTS) chưa có trong checklist
        checklist_ids_covered: set[str] = set()
        for item in approval_checklist:
            for tok in re.split(r'[\s(),\[\]]', item):
                if re.match(r'^[A-Z]+-\d+$', tok):
                    checklist_ids_covered.add(tok)
        for alert in risk.alerts:
            if (alert.severity == "Critical" and alert.requires_human_approval
                    and alert.alert_id not in checklist_ids_covered
                    and (not alert.related_record or alert.related_record not in checklist_ids_covered)):
                desc_short = alert.description[:80]
                approval_checklist.append(
                    f"[ ] Xác nhận xử lý {alert.alert_id}: {desc_short}"
                )
                checklist_ids_covered.add(alert.alert_id)

        credit_masked = mask_payload_for_openai({
            "options": [{"id": o.credit_case_id, "type": o.request_type,
                         "amount": o.amount_band, "score": o.eligibility_score} for o in bank_options]
        })
        products_masked = mask_payload_for_openai({
            "products": [{"bank": o.bank, "product": o.product_name, "rate": o.annual_rate} for o in bank_options]
        })
        pending = [item for item in approval_checklist if not any(r in item for r in resolved_items)]
        pending_str = "\n".join(pending) if pending else "Không có — tất cả đã xử lý"

        user_prompt = DPA_USER_TEMPLATE.format(
            financial_narrative=financial.narrative[:300],
            risk_narrative=risk.narrative[:300],
            overall_risk=risk.overall_risk_level,
            credit_options=json.dumps(credit_masked, ensure_ascii=False),
            contract_id=contract_id,
            contract_value_band=mask_amount(float(target_contract.get("contract_value", 0))),
            gross_margin=f"{financial.gross_margin_actual:.0%}",
            contract_type=target_contract.get("description", ""),
            bank_products=json.dumps(products_masked, ensure_ascii=False),
            pending_checklist=pending_str
        )
        narrative, call_id = self.safe_openai_call(DPA_SYSTEM, user_prompt)

        # Parse structured reasons từ output OpenAI — chấp nhận 2-4 lý do
        reasons = []
        narrative_text = narrative
        lines = narrative.split("\n")
        for line in lines:
            m = re.search(r'REASON_(\d+):\s*(.+)', line)
            if m:
                reasons.append(m.group(2).strip())
        # Tách phần NARRATIVE ra riêng
        if "NARRATIVE:" in narrative:
            narrative_text = narrative.split("NARRATIVE:")[-1].strip()
        # Fallback nếu OpenAI không follow format gì cả
        if not reasons:
            skip_patterns = re.compile(r'REASON_\d:|NARRATIVE:|Recommendation:|Confidence:|^\s*$')
            fallback = [l.strip() for l in lines if l.strip() and not skip_patterns.search(l)]
            reasons = fallback[:4] if fallback else ["[Xem narrative đầy đủ]"]

        result = DecisionCard(
            contract_id=contract_id,
            recommendation=recommendation,
            confidence_score=overall_confidence,
            reasons=reasons,
            bank_options=bank_options,
            preconditions=preconditions,
            human_approval_required=True,
            approval_checklist=approval_checklist,
            narrative=narrative_text,
            no_recommendation_reason=f"Blocked cases: {blocked_cases}" if blocked_cases and not bank_options else None
        )

        check = validate_recommendation(result.model_dump())
        if not check["ok"]:
            result.narrative += f"\n[SYSTEM WARNING: {check['flags']}]"

        agent_log = self.log(
            input_source=["10_CREDIT_PROFILE", "11_BANK_PRODUCTS", "12_API_CATALOG"],
            output_summary=f"recommendation={recommendation} confidence={overall_confidence} options={len(bank_options)}",
            openai_call_id=call_id,
            masked_fields=["customer_id", "requested_amount", "contract_value"],
            human_approval_required=True,
            pipeline_status="completed"
        )

        return {"output": result, "log": agent_log}
