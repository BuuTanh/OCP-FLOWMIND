def build_final_output(crisis_result, financial_proposal, risk_assessment,
                       decision_card, agent_logs, trace_id: str = "", research_result=None) -> dict:
    return {
        "meta": {
            "contract_id": financial_proposal.target_contract_id,
            "trace_id": trace_id or (agent_logs[0].get("trace_id", "") if agent_logs else ""),
            "generated_at": str(__import__("datetime").datetime.utcnow()),
            "system": "OPC FlowMind v1.0"
        },
        "zone_input": {
            "cashflow_chart": [
                {
                    "month": g.month,
                    "expected_cash_in": g.expected_cash_in,
                    "expected_cash_out": g.expected_cash_out,
                    "projected_closing_cash": g.projected_closing_cash,
                    "status": g.status
                }
                for g in financial_proposal.monthly_gaps
            ],
            "receivables": {
                "open_vnd": financial_proposal.receivable_total_open,
                "pipeline_vnd": financial_proposal.receivable_total_pipeline
            },
            "data_confidence": financial_proposal.data_confidence,
            "missing_fields": financial_proposal.missing_data_fields
        },
        "zone_workflow": {
            "crisis_layer": {
                "active": crisis_result["crisis_detected"],
                "resolved": crisis_result.get("crisis_resolved", False),
                "alert": crisis_result["alert"].model_dump() if crisis_result.get("alert") else None
            },
            "pipeline": [
                {
                    "step": 1, "agent": "Chuyên viên dữ liệu và tài chính", "status": "Hoàn tất",
                    "summary": (
                        f"Biên lợi nhuận gộp: {financial_proposal.gross_margin_actual:.0%} | "
                        f"Thiếu hụt vốn 3 tháng: {financial_proposal.total_funding_gap_3m/1e6:,.0f} triệu đồng\n\n"
                        + (financial_proposal.narrative or "")
                    ),
                    "has_warning": not financial_proposal.gross_margin_ok
                },
                {
                    "step": 2, "agent": "Chuyên viên rủi ro và tuân thủ",
                    "status": "Hoàn tất",
                    "summary": (
                        f"Mức rủi ro: {risk_assessment.overall_risk_level} | {len(risk_assessment.alerts)} cảnh báo\n"
                        + (f"Điều kiện đang cản trở: {risk_assessment.blocked_by}\n" if risk_assessment.blocked_by else "")
                        + "\n" + (risk_assessment.narrative or "")
                    ),
                    "has_warning": risk_assessment.overall_risk_level in ("Critical", "High"),
                    "critical_alerts": risk_assessment.blocked_by if not risk_assessment.pipeline_should_continue else None
                },
                {
                    "step": 3, "agent": "Chuyên viên nghiên cứu doanh nghiệp và thị trường", "status": "Hoàn tất",
                    "summary": (
                        f"Đánh giá thông tin phi tài chính: {(research_result or {}).get('overall', {}).get('sentiment', 'CHƯA ĐỦ DỮ LIỆU')}\n"
                        f"Khuyến nghị: {(research_result or {}).get('overall', {}).get('decision_support', 'Cần thẩm định bổ sung')}"
                    ),
                    "has_warning": (research_result or {}).get("overall", {}).get("sentiment") != "TÍCH CỰC"
                },
                {
                    "step": 4, "agent": "Chuyên viên tham mưu quyết định", "status": "Hoàn tất",
                    "summary": (
                        f"Khuyến nghị: {decision_card.recommendation} | Độ tin cậy: {decision_card.confidence_score:.0%}\n\n"
                        + (decision_card.narrative or "")
                    ),
                    "has_warning": decision_card.confidence_score < 0.65
                }
            ],
            "feedback_loop_triggered": not risk_assessment.pipeline_should_continue
        },
        "zone_research": research_result,
        "zone_decision": {
            "recommendation": decision_card.recommendation,
            "confidence_score": decision_card.confidence_score,
            "confidence_ok": decision_card.confidence_score >= 0.65,
            "three_reasons": [r.model_dump() for r in decision_card.reasons],
            "guard_condition": decision_card.guard_condition,
            "bank_options": [
                {
                    "bank": opt.bank,
                    "product_name": opt.product_name,
                    "amount_band": opt.amount_band,
                    "annual_rate": opt.annual_rate,
                    "eligibility_score": opt.eligibility_score,
                    "fit_reason": opt.fit_reason,
                    "requires_approval": opt.requires_human_approval
                }
                for opt in decision_card.bank_options
            ],
            "risk_alerts": [
                {
                    "alert_id": a.alert_id,
                    "severity": a.severity,
                    "rule_id": a.rule_id,
                    "related_record": a.related_record,
                    "description": a.description,
                    "action": a.recommended_action,
                    "requires_human_approval": a.requires_human_approval
                }
                for a in risk_assessment.alerts
            ],
            "preconditions": decision_card.preconditions,
            "approval_checklist": decision_card.approval_checklist,
            # Button chỉ bị block khi có crisis chưa xử lý.
            # Các risk khác (margin, alert) thể hiện qua recommendation — người dùng tự quyết định.
            "confirm_button_enabled": (
                not crisis_result["crisis_detected"]
                or crisis_result.get("crisis_resolved", False)
            ),
            "confirm_button_disabled_reason": (
                "Còn giao dịch đáng ngờ chưa xử lý: "
                + ", ".join(crisis_result["alert"].txn_ids) + " — Founder cần xác nhận HOLD trước"
                if crisis_result["crisis_detected"] and not crisis_result.get("crisis_resolved")
                   and crisis_result.get("alert")
                else None
            ),
            "no_recommendation_reason": decision_card.no_recommendation_reason,
            "narrative": decision_card.narrative,
            "missing_items": decision_card.missing_items or {}
        },
        "agent_logs": agent_logs
    }
