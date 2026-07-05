def validate_financial_narrative(narrative: str, cashflow_records: list[dict]) -> dict:
    flags = []
    if "1 tỷ" in narrative and not any(
        float(r.get("projected_closing_cash", 0)) >= 1_000_000_000
        for r in cashflow_records
    ):
        flags.append("Narrative mentions 1B closing cash but data shows no such month")
    return {"ok": len(flags) == 0, "flags": flags}

def validate_recommendation(decision_card: dict) -> dict:
    flags = []
    confidence = decision_card.get("confidence_score", 0)
    recommendation = decision_card.get("recommendation", "")
    if confidence < 0.65 and recommendation not in ("CHUA_DU_DU_LIEU", "KHONG_KY"):
        flags.append(f"confidence={confidence} < 0.65 but recommendation is {recommendation}")
    return {"ok": len(flags) == 0, "flags": flags}
