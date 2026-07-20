import json, uuid, time
from agents.dfa import DataFinanceAgent
from agents.rca import RiskComplianceAgent
from agents.dpa import DecisionPartnerAgent
from agents.crisis_layer import run_crisis_scan
from agents.research_agent import run_contract_research
from output.schema import build_final_output
from config import TARGET_CONTRACT_ID
from data import gsheet_loader

def run_pipeline(contract_id: str = TARGET_CONTRACT_ID,
                 founder_crisis_resolved: bool = False,
                 resolved_items: list = None,
                 resolved_credit_items: list = None) -> dict:
    logs = []
    # Một trace_id dùng chung cho toàn bộ lượt chạy pipeline (crisis layer + 3 agent),
    # cho phép truy vết mọi log/lượt gọi OpenAI của cùng một phiên phân tích.
    trace_id = str(uuid.uuid4())
    print(f"\n{'='*60}")
    print(f"OPC FlowMind — Phân tích {contract_id} (trace_id={trace_id})")
    print(f"{'='*60}\n")

    # Tải song song mọi tab Google Sheets 1 lần — thay vì để DFA/RCA/DPA lần lượt
    # tự fetch tuần tự khi cần (mỗi agent gọi loader nhiều lần, cộng dồn rất chậm).
    t0 = time.time()
    gsheet_loader.prefetch_all()
    print(f"[PREFETCH] Đã tải xong dữ liệu Google Sheets trong {time.time()-t0:.1f}s")

    print("[CRISIS LAYER] Scanning suspicious transactions...")
    crisis_result = run_crisis_scan(trace_id=trace_id)
    crisis_result["crisis_resolved"] = founder_crisis_resolved  # ghi nhận quyết định founder
    if crisis_result.get("log"):
        logs.append(crisis_result["log"].model_dump())

    if crisis_result["crisis_detected"] and not founder_crisis_resolved:
        print(f"[CRISIS] CANH BAO — Crisis detected: {crisis_result['alert'].txn_ids}")
        print("[CRISIS] Cho Founder xac nhan HOLD truoc khi tiep tuc.")

    print(f"\n[STAGE 1] Data & Finance Agent dang chay...")
    dfa = DataFinanceAgent()
    dfa_result = dfa.run({"contract_id": contract_id, "trace_id": trace_id})
    financial_proposal = dfa_result["output"]
    logs.append(dfa_result["log"].model_dump())
    print(f"[DFA] OK margin={financial_proposal.gross_margin_actual:.0%} "
          f"gap_3m={financial_proposal.total_funding_gap_3m:,.0f}")

    print(f"\n[STAGE 2] Risk & Compliance Agent dang chay...")
    rca = RiskComplianceAgent()
    rca_result = rca.run({
        "financial_proposal": financial_proposal,
        "resolved_items": resolved_items or [],
        "trace_id": trace_id,
    })
    risk_assessment = rca_result["output"]
    logs.append(rca_result["log"].model_dump())
    print(f"[RCA] OK overall={risk_assessment.overall_risk_level} "
          f"alerts={len(risk_assessment.alerts)}")

    if not risk_assessment.pipeline_should_continue:
        print(f"\n[PIPELINE] Blocked: {risk_assessment.blocked_by}")

    print("\n[GIAI ĐOẠN 3] Đang tra cứu thông tin doanh nghiệp và thị trường...")
    research_result = run_contract_research(contract_id)
    research_sentiment = research_result.get("overall", {}).get("sentiment", "CHƯA ĐỦ DỮ LIỆU")

    print(f"\n[GIAI ĐOẠN 4] Đang lập khuyến nghị quản trị...")
    dpa = DecisionPartnerAgent()
    dpa_result = dpa.run({
        "financial_proposal": financial_proposal,
        "risk_assessment": risk_assessment,
        "crisis_resolved": founder_crisis_resolved,
        "resolved_items": resolved_items or [],
        "resolved_credit_items": resolved_credit_items or [],
        "trace_id": trace_id,
        "research_result": research_result,
    })
    decision_card = dpa_result["output"]
    recommendation_before_research = decision_card.recommendation
    confidence_before_research = decision_card.confidence_score
    if research_sentiment in ("TIÊU CỰC", "CHƯA ĐỦ DỮ LIỆU"):
        decision_card.confidence_score = max(0.15, round(decision_card.confidence_score - 0.08, 2))
        note = ("Xác minh thêm thông tin phi tài chính của đối tác và diễn biến ngành"
                if research_sentiment == "CHƯA ĐỦ DỮ LIỆU" else
                "Bổ sung điều kiện bảo vệ trước diễn biến bất lợi của doanh nghiệp hoặc thị trường")
        if note not in decision_card.preconditions:
            decision_card.preconditions.append(note)
        if decision_card.recommendation == "KY":
            decision_card.recommendation = "KY_CO_DIEU_KIEN"
    research_result.setdefault("overall", {}).update({
        "recommendation_before_research": recommendation_before_research,
        "recommendation_after_research": decision_card.recommendation,
        "confidence_before_research": confidence_before_research,
        "confidence_after_research": decision_card.confidence_score,
        "confidence_adjustment": round(decision_card.confidence_score - confidence_before_research, 2),
        "impact_summary": (
            "Kết quả thẩm định phi tài chính đã làm giảm độ tin cậy và bổ sung điều kiện kiểm soát."
            if decision_card.confidence_score < confidence_before_research else
            "Kết quả thẩm định phi tài chính chưa làm thay đổi khuyến nghị ban đầu."
        ),
    })
    logs.append(dpa_result["log"].model_dump())
    print(f"[DPA] OK recommendation={decision_card.recommendation} "
          f"confidence={decision_card.confidence_score}")

    final = build_final_output(
        crisis_result=crisis_result,
        financial_proposal=financial_proposal,
        risk_assessment=risk_assessment,
        decision_card=decision_card,
        agent_logs=logs,
        trace_id=trace_id,
        research_result=research_result,
    )
    print(f"\n[OUTPUT] Hoan tat. Recommendation: {decision_card.recommendation}")
    return final


if __name__ == "__main__":
    result = run_pipeline(TARGET_CONTRACT_ID)
    print("\n" + "="*60)
    print("FINAL OUTPUT JSON:")
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
