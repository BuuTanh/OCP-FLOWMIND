"""
Google Sheets loader — đọc public sheets qua CSV export URL.
Không cần service account, chỉ cần sheet được share "Anyone with link".

Sheet IDs:
  OPC_CoreData:     16991q6bJPKLRt8_8aI29m7CTfpepHqQF
  OPC_FinancialData: 1Z2YsFXamos8IYVD6sFGuND5dXy96bPAc
  OPC_RulesRAG:     1U3uMdlz0vdysokFVknU9VRE-DtapFfq-
"""

import pandas as pd
import io
import requests
import time
from typing import Optional

# ── Sheet IDs ────────────────────────────────────────────────────────────
SHEET_IDS = {
    "core":      "16991q6bJPKLRt8_8aI29m7CTfpepHqQF",
    "financial": "1Z2YsFXamos8IYVD6sFGuND5dXy96bPAc",
    "rules":     "1U3uMdlz0vdysokFVknU9VRE-DtapFfq-",
}

# Tab names → sheet group mapping
SHEET_TAB_MAP = {
    # Core data
    "opc_profile":    ("core",      "02_OPC_PROFILE"),
    "customers":      ("core",      "03_CUSTOMERS"),
    "contracts":      ("core",      "04_CONTRACTS"),
    "products":       ("core",      "05_PRODUCTS"),
    "orders":         ("core",      "06_ORDERS"),
    "invoices":       ("core",      "07_INVOICES"),
    # Financial data
    "bank_txn":       ("financial", "08_BANK_TXN"),
    "cashflow":       ("financial", "09_CASHFLOW"),
    "credit_profile": ("financial", "10_CREDIT_PROFILE"),
    "bank_products":  ("financial", "11_BANK_PRODUCTS"),
    # Rules / RAG
    "api_catalog":    ("rules",     "12_API_CATALOG"),
    "risk_rules":     ("rules",     "13_RISK_RULES"),
    "alerts":         ("rules",     "14_ALERTS"),
    "api_handling":   ("rules",     "22_API_HANDLING_RULES"),
}

_cache: dict[str, tuple[pd.DataFrame, float]] = {}
CACHE_TTL = 300  # 5 minutes


def _csv_url(sheet_id: str, tab_name: str) -> str:
    import urllib.parse
    encoded = urllib.parse.quote(tab_name)
    return (
        f"https://docs.google.com/spreadsheets/d/{sheet_id}"
        f"/gviz/tq?tqx=out:csv&sheet={encoded}"
    )


def load_gsheet(key: str) -> pd.DataFrame:
    """Load a tab from Google Sheets with 5-minute cache."""
    now = time.time()
    if key in _cache:
        df, ts = _cache[key]
        if now - ts < CACHE_TTL:
            return df.copy()

    if key not in SHEET_TAB_MAP:
        raise ValueError(f"Unknown sheet key: {key}")

    group, tab_name = SHEET_TAB_MAP[key]
    sheet_id = SHEET_IDS[group]
    url = _csv_url(sheet_id, tab_name)

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), dtype=str).fillna("")
        _cache[key] = (df, now)
        return df.copy()
    except Exception as e:
        # Fallback: nếu không đọc được Sheets, thử Excel local
        print(f"[GSheet] Warning: cannot load {tab_name} from Sheets: {e}")
        return _fallback_excel(key)


def _fallback_excel(key: str) -> pd.DataFrame:
    """Fallback to local Excel file if Sheets unavailable."""
    import os
    from config import XLSX_PATH, SHEETS
    if not os.path.exists(XLSX_PATH):
        return pd.DataFrame()
    tab = SHEETS.get(key, key)
    try:
        return pd.read_excel(XLSX_PATH, sheet_name=tab, dtype=str).fillna("")
    except Exception:
        return pd.DataFrame()


def invalidate_cache(key: Optional[str] = None):
    """Force reload on next access."""
    global _cache
    if key:
        _cache.pop(key, None)
    else:
        _cache.clear()


# ── Typed accessors (same interface as loader.py) ─────────────────────────

def _excel_serial_to_date(serial: int) -> str:
    """Convert Excel date serial number to YYYY-MM-DD string."""
    from datetime import date, timedelta
    try:
        base = date(1899, 12, 30)
        return (base + timedelta(days=serial)).strftime("%Y-%m-%d")
    except Exception:
        return str(serial)


def get_opc_profile() -> dict:
    df = load_gsheet("opc_profile")
    if df.empty:
        return {}
    return dict(zip(df.iloc[:, 0], df.iloc[:, 1]))

def get_contracts() -> list[dict]:
    df = load_gsheet("contracts")
    records = df.to_dict("records")
    for r in records:
        # Fix gross_margin: '0,3' → 0.3
        for col in ("gross_margin",):
            if col in r:
                r[col] = str(r[col]).replace(",", ".")
        # Fix Excel date serial numbers → YYYY-MM-DD
        for col in ("start_date", "end_date"):
            if col in r and str(r[col]).isdigit():
                r[col] = _excel_serial_to_date(int(r[col]))
    return records

def get_customers() -> list[dict]:
    return load_gsheet("customers").to_dict("records")

def get_orders() -> list[dict]:
    return load_gsheet("orders").to_dict("records")

def get_invoices() -> list[dict]:
    return load_gsheet("invoices").to_dict("records")

def get_bank_txn() -> list[dict]:
    return load_gsheet("bank_txn").to_dict("records")

def get_cashflow() -> list[dict]:
    return load_gsheet("cashflow").to_dict("records")

def get_credit_profile() -> list[dict]:
    return load_gsheet("credit_profile").to_dict("records")

def get_bank_products() -> list[dict]:
    return load_gsheet("bank_products").to_dict("records")

def get_risk_rules() -> list[dict]:
    return load_gsheet("risk_rules").to_dict("records")
