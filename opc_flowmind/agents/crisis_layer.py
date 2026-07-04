from models.decision import CrisisAlert
from models.agent_log import AgentLog
from mock_api.coopbank import confirm_suspicious_transaction_hold
from data import loader
from config import TRANSACTION_RISK_CRITICAL
import uuid, datetime

def run_crisis_scan() -> dict:
    bank_txn = loader.get_bank_txn()

    suspicious = [
        t for t in bank_txn
        if float(t.get("transaction_risk_score", 0)) >= TRANSACTION_RISK_CRITICAL
    ]

    if not suspicious:
        return {"crisis_detected": False, "alert": None, "crisis_resolved": False}

    txn_ids     = [t["txn_id"] for t in suspicious]
    risk_scores = {t["txn_id"]: float(t["transaction_risk_score"]) for t in suspicious}

    hold_response = confirm_suspicious_transaction_hold(txn_ids, action="temporary_hold")

    alert = CrisisAlert(
        txn_ids=txn_ids,
        risk_scores=risk_scores,
        action="HOLD_PENDING_APPROVAL",
        founder_notified=True,
        requires_immediate_action=True,
        description=(
            f"CRISIS: {len(txn_ids)} giao dịch đáng ngờ: {txn_ids}. "
            f"Risk scores: {risk_scores}. "
            f"Chờ Founder xác nhận HOLD (không thể đảo ngược — API-H-003)."
        )
    )

    log = AgentLog(
        log_id=str(uuid.uuid4())[:8],
        agent_name="Crisis Layer",
        task_id="CRISIS-001",
        timestamp=str(datetime.datetime.utcnow()),
        input_source=["08_BANK_TXN"],
        output_summary=f"CRISIS: {txn_ids} scores={risk_scores} → HOLD_PENDING",
        openai_call_id=None,
        masked_fields=["txn_id", "account_id"],
        human_approval_required=True,
        pipeline_status="blocked_crisis"
    )

    return {
        "crisis_detected": True,
        "alert": alert,
        "crisis_resolved": False,
        "hold_api_response": hold_response,
        "log": log
    }
