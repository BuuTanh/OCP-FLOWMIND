"""
Lưu và đọc lịch sử chạy pipeline.
Mỗi lần chạy = 1 file JSON trong output/results/
"""

import json, os, datetime

RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")

def save_result(result: dict, contract_id: str) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{contract_id}_{ts}.json"
    filepath = os.path.join(RESULTS_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2, default=str)
    return filepath

def load_history() -> list[dict]:
    """Trả về danh sách các lần chạy gần nhất (tối đa 10)."""
    if not os.path.exists(RESULTS_DIR):
        return []
    files = sorted(
        [f for f in os.listdir(RESULTS_DIR) if f.endswith(".json")],
        reverse=True
    )[:10]
    history = []
    for f in files:
        try:
            with open(os.path.join(RESULTS_DIR, f), encoding="utf-8") as fp:
                data = json.load(fp)
            meta = data.get("meta", {})
            zd   = data.get("zone_decision", {})
            history.append({
                "filename": f,
                "contract_id":   meta.get("contract_id", "—"),
                "generated_at":  meta.get("generated_at", "—")[:19],
                "recommendation": zd.get("recommendation", "—"),
                "confidence":    zd.get("confidence_score", 0),
                "crisis":        data.get("zone_workflow", {}).get("crisis_layer", {}).get("active", False),
            })
        except Exception:
            continue
    return history

def load_result_file(filename: str) -> dict:
    filepath = os.path.join(RESULTS_DIR, filename)
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)

def save_crisis_log(txn_ids: list, risk_scores: dict, contract_id: str):
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crisis_log.txt")
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"\n[{ts}] CRISIS DETECTED — Contract: {contract_id}\n")
        f.write(f"  TXN flagged: {txn_ids}\n")
        f.write(f"  Risk scores: {risk_scores}\n")
        f.write(f"  Action: HOLD_PENDING_FOUNDER_APPROVAL\n")
        f.write("-" * 60 + "\n")
