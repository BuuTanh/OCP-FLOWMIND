from data.masking import tokenize_id

def get_cooperative_profile(customer_id: str) -> dict:
    tok = tokenize_id(customer_id)
    profiles = {
        "CUS-005": {
            "tok": tok, "customer_type": "Cooperative",
            "payment_reliability": 0.83,
            "banking_relationship": "CoopBank primary",
            "local_presence": "Cần Thơ + 5 tỉnh đồng bằng"
        }
    }
    return {
        "api_id": "API-004", "provider": "CoopBank", "status": "mock_success",
        "data": profiles.get(customer_id, {"tok": tok, "status": "no_profile"}),
        "note": "MOCK DATA"
    }

def precheck_micro_credit(customer_type: str, amount: float, receivables: list) -> dict:
    return {
        "api_id": "API-005", "provider": "CoopBank",
        "status": "mock_pending_human_approval", "customer_type": customer_type,
        "amount_band": f"~{amount/1_000_000:.0f}M",
        "eligibility": "good_fit" if customer_type in ("Cooperative", "Household") else "review_needed",
        "bank_product": "BANKPROD-006", "requires_human_approval": True,
        "note": "MOCK — CR-004 scenario"
    }

def confirm_suspicious_transaction_hold(txn_ids: list, action: str = "temporary_hold") -> dict:
    return {
        "api_id": "API-006", "provider": "CoopBank",
        "status": "PENDING_FOUNDER_APPROVAL", "txn_ids": txn_ids, "action": action,
        "message": "Hành động này không thể đảo ngược. Chờ founder xác nhận (API-H-003).",
        "requires_human_approval": True, "irreversible": True
    }
