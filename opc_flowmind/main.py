import json, uuid
from agents.dfa import DataFinanceAgent
from agents.rca import RiskComplianceAgent
from agents.dpa import DecisionPartnerAgent
from agents.crisis_layer import run_crisis_scan
from output.schema import build_final_output
from config import TARGET_CONTRACT_ID

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

    print(f"\n[STAGE 3] Decision & Partner Agent dang chay...")
    dpa = DecisionPartnerAgent()
    dpa_result = dpa.run({
        "financial_proposal": financial_proposal,
        "risk_assessment": risk_assessment,
        "crisis_resolved": founder_crisis_resolved,
        "resolved_items": resolved_items or [],
        "resolved_credit_items": resolved_credit_items or [],
        "trace_id": trace_id,
    })
    decision_card = dpa_result["output"]
    logs.append(dpa_result["log"].model_dump())
    print(f"[DPA] OK recommendation={decision_card.recommendation} "
          f"confidence={decision_card.confidence_score}")

    final = build_final_output(
        crisis_result=crisis_result,
        financial_proposal=financial_proposal,
        risk_assessment=risk_assessment,
        decision_card=decision_card,
        agent_logs=logs,
        trace_id=trace_id
    )
    print(f"\n[OUTPUT] Hoan tat. Recommendation: {decision_card.recommendation}")
    return final


if __name__ == "__main__":
    result = run_pipeline(TARGET_CONTRACT_ID)
    print("\n" + "="*60)
    print("FINAL OUTPUT JSON:")
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
