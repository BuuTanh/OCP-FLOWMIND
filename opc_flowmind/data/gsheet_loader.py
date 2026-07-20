"""
Google Sheets loader — đọc public sheets qua CSV export URL.
Không cần service account, chỉ cần sheet được share "Anyone with link".

Sheet IDs:
  OPC_CoreData:     11ehIbSy2Aw9KPjXrN0XN90wQ5BPx613m3beZRYji7qI
  OPC_FinancialData: 1p5A4AP1OMx0xonZXUqVFqphgm6yKgCP79v33vzflXBo
  OPC_RulesRAG:     1C-WNOIB00GPKmc17obCRbhoi0oVy83IJ2UEt2CF077w
"""

import pandas as pd
import io
import requests
import time
from datetime import datetime
from typing import Optional

# ── Sheet IDs ────────────────────────────────────────────────────────────
SHEET_IDS = {
    "core":      "11ehIbSy2Aw9KPjXrN0XN90wQ5BPx613m3beZRYji7qI",
    "financial": "1p5A4AP1OMx0xonZXUqVFqphgm6yKgCP79v33vzflXBo",
    "rules":     "1C-WNOIB00GPKmc17obCRbhoi0oVy83IJ2UEt2CF077w",
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

# 22_API_HANDLING_RULES: thử lại tối đa hai lần có giãn cách trước khi dùng dữ liệu đệm.
MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 1


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

    last_error: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 2):  # lần đầu + tối đa 2 lần thử lại
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            df = pd.read_csv(io.StringIO(resp.text), dtype=str).fillna("")
            _cache[key] = (df, now)
            return df.copy()
        except Exception as e:
            last_error = e
            if attempt <= MAX_RETRIES:
                wait = RETRY_BACKOFF_SECONDS * attempt
                print(f"[GSheet] {tab_name} lỗi lần {attempt}: {e} — thử lại sau {wait}s")
                time.sleep(wait)

    # Hết lượt thử lại: ưu tiên dữ liệu đệm gần nhất kèm nhãn thời điểm (dù đã quá TTL),
    # chỉ rơi về Excel local khi phiên chạy này chưa từng fetch được key này lần nào.
    if key in _cache:
        cached_df, cached_ts = _cache[key]
        age_min = (now - cached_ts) / 60
        cached_at = datetime.fromtimestamp(cached_ts).strftime("%Y-%m-%d %H:%M:%S")
        print(f"[GSheet] {tab_name}: thất bại sau {MAX_RETRIES} lần thử lại ({last_error}). "
              f"Dùng dữ liệu đệm lúc {cached_at} ({age_min:.1f} phút trước).")
        return cached_df.copy()

    print(f"[GSheet] {tab_name}: thất bại sau {MAX_RETRIES} lần thử lại, không có dữ liệu đệm. "
          f"Chuyển sang Excel local. Lỗi gốc: {last_error}")
    return _fallback_excel(key)


def prefetch_all() -> None:
    """
    Tải song song mọi tab thay vì để từng agent tự fetch tuần tự khi cần.
    ~10-14 tab tải tuần tự có thể mất 10-30s cộng dồn; tải song song chỉ mất bằng
    thời gian của tab chậm nhất. Gọi 1 lần ở đầu run_pipeline() — sau đó mọi
    loader.get_x() trong DFA/RCA/DPA đều trúng cache, không phải gọi mạng nữa.
    Lỗi từng tab (nếu có) vẫn được load_gsheet() tự xử lý (retry/cache/Excel) như bình thường.
    """
    from concurrent.futures import ThreadPoolExecutor
    keys = list(SHEET_TAB_MAP.keys())
    with ThreadPoolExecutor(max_workers=len(keys)) as pool:
        pool.map(load_gsheet, keys)


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

def _parse_amount(v) -> float:
    try:
        return float(str(v).replace(",", "").replace("%", ""))
    except (ValueError, TypeError):
        return 0.0

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
    # concentration_pct (Phụ lục 2): tỷ trọng giá trị hợp đồng trên tổng giá trị danh mục,
    # tính động theo toàn bộ danh mục hiện có — không hardcode.
    total_value = sum(_parse_amount(r.get("contract_value", 0)) for r in records)
    for r in records:
        cv = _parse_amount(r.get("contract_value", 0))
        r["concentration_pct"] = round(cv / total_value * 100, 1) if total_value > 0 else 0.0
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
