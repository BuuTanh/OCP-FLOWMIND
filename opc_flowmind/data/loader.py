"""
Data loader — ưu tiên Google Sheets, fallback về Excel local nếu mất mạng.
"""
import re
import pandas as pd
from config import XLSX_PATH, SHEETS

# ── Excel fallback ────────────────────────────────────────────────────────
_excel_cache = {}

def _load_excel(sheet_key: str) -> pd.DataFrame:
    if sheet_key not in _excel_cache:
        _excel_cache[sheet_key] = pd.read_excel(
            XLSX_PATH, sheet_name=SHEETS[sheet_key], dtype=str
        ).fillna("")
    return _excel_cache[sheet_key].copy()

# ── GSheet wrapper ────────────────────────────────────────────────────────
_use_gsheet = True

def _load(sheet_key: str) -> pd.DataFrame:
    if _use_gsheet:
        try:
            from data.gsheet_loader import load_gsheet
            df = load_gsheet(sheet_key)
            if not df.empty:
                return df
        except Exception:
            pass
    return _load_excel(sheet_key)

# ── Numeric normalization ─────────────────────────────────────────────────
_NUMERIC_RE = re.compile(r'^-?\d+,\d+$')   # matches '0,71' or '-1,5'

def _fix_comma(v: str) -> str:
    """'0,71' → '0.71'  (only if it looks like a decimal number)"""
    s = str(v).strip()
    if _NUMERIC_RE.match(s):
        return s.replace(",", ".")
    return s

def _normalize(records: list[dict], cols: tuple) -> list[dict]:
    """Fix comma-decimal in specified columns for all rows."""
    for r in records:
        for col in cols:
            if col in r and r[col] != "":
                r[col] = _fix_comma(r[col])
    return records

# ── Public API ────────────────────────────────────────────────────────────

def get_opc_profile() -> dict:
    df = _load("opc_profile")
    return dict(zip(df.iloc[:, 0], df.iloc[:, 1]))

def get_cashflow() -> list[dict]:
    records = _load("cashflow").to_dict("records")
    return _normalize(records, (
        "expected_cash_in", "expected_cash_out",
        "projected_closing_cash", "cash_reserve_minimum",
        "direct_cost", "opex",
    ))

def get_contracts() -> list[dict]:
    records = _load("contracts").to_dict("records")
    return _normalize(records, ("gross_margin", "contract_value"))

def get_orders() -> list[dict]:
    records = _load("orders").to_dict("records")
    return _normalize(records, ("order_revenue", "estimated_cost"))

def get_invoices() -> list[dict]:
    records = _load("invoices").to_dict("records")
    return _normalize(records, ("invoice_amount",))

def get_bank_txn() -> list[dict]:
    records = _load("bank_txn").to_dict("records")
    return _normalize(records, ("amount", "transaction_risk_score"))

def get_customers() -> list[dict]:
    return _load("customers").to_dict("records")

def get_credit_profile() -> list[dict]:
    records = _load("credit_profile").to_dict("records")
    return _normalize(records, (
        "eligibility_score", "requested_amount",
        "approved_amount", "interest_rate",
    ))

def get_bank_products() -> list[dict]:
    records = _load("bank_products").to_dict("records")
    return _normalize(records, (
        "annual_rate_or_fee", "max_amount", "min_amount",
    ))

def get_risk_rules() -> list[dict]:
    return _load("risk_rules").to_dict("records")

def get_alerts() -> list[dict]:
    try:
        return _load("alerts").to_dict("records")
    except Exception:
        return []
