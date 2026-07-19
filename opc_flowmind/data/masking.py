import hashlib

_token_cache = {}
_reverse_cache: dict[str, str] = {}  # token → raw_id, dùng để giải mã ngược phản hồi OpenAI

def tokenize_id(raw_id: str, prefix: str = "TOK") -> str:
    if not raw_id:
        return raw_id
    if raw_id not in _token_cache:
        hash4 = hashlib.sha1(raw_id.encode()).hexdigest()[:4].upper()
        type_part = raw_id.split("-")[0] if "-" in raw_id else "GEN"
        token = f"{prefix}-{type_part}-{hash4}"
        _token_cache[raw_id] = token
        _reverse_cache[token] = raw_id
    return _token_cache[raw_id]

def unmask_text(text: str) -> str:
    """
    Ánh xạ ngược mọi token (VD: TOK-CUS-A91F) xuất hiện trong phản hồi OpenAI
    về lại giá trị gốc (VD: CUS-005), trước khi hiển thị cho founder.
    Chỉ thay các token đã thực sự được sinh ra trong phiên chạy hiện tại
    (có trong _reverse_cache) — không suy đoán/tự tạo giá trị gốc cho token lạ.
    """
    if not text or not _reverse_cache:
        return text
    for token, raw_id in _reverse_cache.items():
        if token in text:
            text = text.replace(token, raw_id)
    return text

def mask_amount(amount: float) -> str:
    if amount >= 1_000_000_000:
        return f"~{amount/1_000_000_000:.1f}B band"
    elif amount >= 1_000_000:
        return f"~{amount/1_000_000:.0f}M band"
    return f"~{amount:,.0f}"

def mask_payload_for_openai(payload: dict) -> dict:
    MASK_KEYS   = {"customer_id", "account_id", "counterparty_id", "company_id"}
    BAND_KEYS   = {"contract_value", "requested_amount", "projected_closing_cash",
                   "invoice_amount", "amount"}
    SECRET_KEYS = {"api_key", "access_token", "password"}

    def _mask(obj):
        if isinstance(obj, dict):
            return {
                k: "[SECRET]"          if k in SECRET_KEYS
                   else tokenize_id(str(v)) if k in MASK_KEYS and v
                   else mask_amount(float(v)) if k in BAND_KEYS and v and not str(v).startswith("~")
                   else _mask(v)
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [_mask(i) for i in obj]
        return obj

    return _mask(payload)
