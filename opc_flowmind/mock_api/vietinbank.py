from data.masking import tokenize_id

def get_account_statement(account_id: str, from_date: str, to_date: str) -> dict:
    tok = tokenize_id(account_id)
    return {
        "api_id": "API-001", "provider": "VietinBank", "status": "mock_success",
        "account_id": tok, "from_date": from_date, "to_date": to_date,
        "transactions": [
            {"txn_id": "TXN-001", "direction": "Credit",  "amount": 52_000_000,   "risk_score": 12},
            {"txn_id": "TXN-003", "direction": "Debit",   "amount": -74_000_000,  "risk_score": 25},
            {"txn_id": "TXN-005", "direction": "Debit",   "amount": -185_000_000, "risk_score": 40},
            {"txn_id": "TXN-006", "direction": "Debit",   "amount": -86_000_000,  "risk_score": 88, "status": "Suspicious"},
            {"txn_id": "TXN-007", "direction": "Debit",   "amount": -92_000_000,  "risk_score": 91, "status": "Suspicious"},
            {"txn_id": "TXN-009", "direction": "Debit",   "amount": -68_000_000,  "risk_score": 22},
            {"txn_id": "TXN-010", "direction": "Credit",  "amount": 300_000_000,  "risk_score": 5},
        ],
        "note": "MOCK DATA — không phải dữ liệu ngân hàng thật"
    }

def precheck_performance_bond(contract_id: str, amount: float) -> dict:
    return {
        "api_id": "API-002", "provider": "VietinBank",
        "status": "mock_pending_human_approval", "contract_id": contract_id,
        "amount_band": f"~{amount/1_000_000:.0f}M",
        "eligibility_precheck": "conditional",
        "conditions": ["Contract CON-004 must be signed", "Cashflow buffer confirmation required"],
        "requires_human_approval": True, "bank_product": "BANKPROD-002",
        "note": "MOCK — human_approval bắt buộc trước khi submit thật"
    }

def precheck_trade_finance(contract_id: str, amount: float, docs_complete: bool) -> dict:
    if not docs_complete:
        return {
            "api_id": "API-003", "status": "blocked_missing_docs",
            "reason": "supplier_confirmation is NULL — cannot proceed (API-H-002)",
            "requires_human_approval": True,
            "action_required": "Request supplier confirmation from CUS-008"
        }
    return {
        "api_id": "API-003", "provider": "VietinBank",
        "status": "mock_pending_human_approval", "contract_id": contract_id,
        "amount_band": f"~{amount/1_000_000:.0f}M",
        "bank_product": "BANKPROD-003", "requires_human_approval": True
    }
