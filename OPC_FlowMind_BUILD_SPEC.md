# OPC FLOWMIND — AI AGENT BUILD SPEC
> **Mục đích file này:** Import vào code chat → build AI agent system hoàn chỉnh.  
> **Task của bạn:** Build 3 AI Agent (DFA → RCA → DPA) + Crisis Layer + API mock layer + output JSON.  
> **Giao diện:** Do team khác build, bạn chỉ cần output đúng schema cuối file này.

---

## 0. PROJECT OVERVIEW

### Tên hệ thống
**OPC FlowMind — Agentic AI Decision Hub**

### Bài toán
OPC Digital Operations Co. (One Person Company) cần quyết định:  
> **"Có nên nhận CON-004 (4.2 tỷ VND, rollout 20 tỉnh) không? Nếu nhận thì cần tài trợ tài chính gì từ đối tác nào?"**

### Kiến trúc tổng thể
```
┌─────────────────────────────────────────────────────────────────────┐
│                        FOUNDER (Human Gate)                         │
│              Xác nhận / Từ chối / Yêu cầu bổ sung                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Decision Card
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│  MAIN PIPELINE (Sequential)                                         │
│                                                                     │
│  [Data & Finance Agent] ──► [Risk & Compliance Agent] ──► [Decision & Partner Agent]
│         DFA                          RCA                          DPA
│          │                            │                            │
│          └────────────────────────────┴────────────────────────────┘
│                           ▲ feedback loop (thiếu data / Critical)  │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│  CRISIS LAYER (Parallel / Independent)                              │
│  Alert Engine ── scan BANK_TXN ── risk_score ≥ 85 → HOLD + Alert  │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│  OpenAI API (Reasoning Engine — xuyên suốt cả 3 agent)             │
│  gpt-4o-mini | temp=0.3 | max_tokens=1000                          │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│  Team Pack Data Layer (Mock Database — đọc từ xlsx)                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. TECH STACK

```
Language:     Python 3.11+
AI Engine:    OpenAI API (openai>=1.0.0) — model: gpt-4o-mini
Orchestration: LangChain (langchain + langchain-openai) HOẶC Python thuần với asyncio
Data Layer:   pandas + openpyxl (đọc Team Pack xlsx)
Agent comm:   Dict/Pydantic models truyền qua pipeline
API Mock:     Static JSON mock (không gọi bank thật)
Output:       JSON schema chuẩn (giao diện sẽ consume)
Env:          python-dotenv (quản lý OPENAI_API_KEY)
```

### Install
```bash
pip install openai langchain langchain-openai pandas openpyxl python-dotenv pydantic
```

### .env
```
OPENAI_API_KEY=sk-...   # KHÔNG commit lên git, KHÔNG log ra console
```

---

## 2. PROJECT STRUCTURE

```
opc_flowmind/
├── main.py                     # Entry point: chạy pipeline
├── config.py                   # Constants, paths, thresholds
├── .env                        # API key (gitignored)
│
├── data/
│   ├── loader.py               # Load xlsx → DataFrames
│   ├── masking.py              # Tokenize / mask sensitive fields
│   └── MISTalent2026_OPC_AgenticAI_TeamPack_v3.xlsx
│
├── agents/
│   ├── __init__.py
│   ├── base_agent.py           # BaseAgent class
│   ├── dfa.py                  # Data & Finance Agent
│   ├── rca.py                  # Risk & Compliance Agent
│   ├── dpa.py                  # Decision & Partner Agent
│   └── crisis_layer.py         # Crisis Layer (parallel)
│
├── openai_engine/
│   ├── __init__.py
│   ├── client.py               # OpenAI client wrapper
│   ├── prompts.py              # System + user prompts cho từng agent
│   └── validator.py            # Back-check output vs source data
│
├── mock_api/
│   ├── __init__.py
│   ├── vietinbank.py           # Mock VietinBank API responses
│   ├── coopbank.py             # Mock CoopBank API responses
│   └── opc_internal.py        # Mock OPC Internal ERP
│
├── models/
│   ├── __init__.py
│   ├── financial.py            # FinancialProposal, CashflowSummary
│   ├── risk.py                 # RiskAssessment, RiskAlert
│   ├── decision.py             # DecisionCard, OptionMatrix
│   └── agent_log.py            # AgentLog, RuntimeLog
│
└── output/
    └── schema.py               # Final JSON output schema cho UI
```

---

## 3. DATA LAYER — THỰC TẾ TỪ TEAM PACK

### 3.1 File path & sheet names
```python
XLSX_PATH = "data/MISTalent2026_OPC_AgenticAI_TeamPack_v3.xlsx"

SHEETS = {
    "opc_profile":    "02_OPC_PROFILE",
    "customers":      "03_CUSTOMERS",
    "contracts":      "04_CONTRACTS",
    "products":       "05_PRODUCTS",
    "orders":         "06_ORDERS",
    "invoices":       "07_INVOICES",
    "bank_txn":       "08_BANK_TXN",
    "cashflow":       "09_CASHFLOW",
    "credit_profile": "10_CREDIT_PROFILE",
    "bank_products":  "11_BANK_PRODUCTS",
    "api_catalog":    "12_API_CATALOG",
    "risk_rules":     "13_RISK_RULES",
    "alerts":         "14_ALERTS",
    "agent_tasks":    "15_AGENT_TASKS",
    "api_handling":   "22_API_HANDLING_RULES",
}
```

### 3.2 data/loader.py
```python
import pandas as pd
from config import XLSX_PATH, SHEETS

_cache = {}

def load(sheet_key: str) -> pd.DataFrame:
    if sheet_key not in _cache:
        _cache[sheet_key] = pd.read_excel(
            XLSX_PATH, sheet_name=SHEETS[sheet_key], dtype=str
        ).fillna("")
    return _cache[sheet_key].copy()

def get_opc_profile() -> dict:
    df = load("opc_profile")
    return dict(zip(df.iloc[:, 0], df.iloc[:, 1]))

def get_cashflow() -> list[dict]:
    return load("cashflow").to_dict("records")

def get_contracts() -> list[dict]:
    return load("contracts").to_dict("records")

def get_orders() -> list[dict]:
    return load("orders").to_dict("records")

def get_invoices() -> list[dict]:
    return load("invoices").to_dict("records")

def get_bank_txn() -> list[dict]:
    return load("bank_txn").to_dict("records")

def get_customers() -> list[dict]:
    return load("customers").to_dict("records")

def get_credit_profile() -> list[dict]:
    return load("credit_profile").to_dict("records")

def get_bank_products() -> list[dict]:
    return load("bank_products").to_dict("records")

def get_risk_rules() -> list[dict]:
    return load("risk_rules").to_dict("records")

def get_alerts() -> list[dict]:
    return load("alerts").to_dict("records")
```

### 3.3 CONFIG constants (config.py)
```python
# OPC Business Rules (từ 02_OPC_PROFILE + 13_RISK_RULES)
CASH_RESERVE_MINIMUM = 550_000_000   # 550M VND
TARGET_GROSS_MARGIN  = 0.28
LATE_DELIVERY_PENALTY_RATE = 0.015
HUMAN_APPROVAL_THRESHOLD   = 300_000_000  # RR-005
TRANSACTION_RISK_CRITICAL  = 85           # RR-001
CONFIDENCE_THRESHOLD       = 0.65         # RR-006
DELIVERY_DELAY_MAX_DAYS    = 7            # RR-007

# Target contract
TARGET_CONTRACT_ID = "CON-004"
TARGET_CONTRACT_VALUE = 4_200_000_000

# OpenAI
OPENAI_MODEL = "gpt-4o-mini"
OPENAI_TEMPERATURE = 0.3
OPENAI_MAX_TOKENS = 1000
```

---

## 4. DATA MASKING (data/masking.py)

```python
"""
Theo 20_DATA_CLASS + 21_MASKING_EXAMPLES:
- restricted: customer_id, account_id, counterparty_id → tokenize
- confidential: contract_value → band (~4.2B)
- secret: api_key, access_token → [SECRET]
"""

import hashlib

_token_cache = {}

def tokenize_id(raw_id: str, prefix: str = "TOK") -> str:
    """CUS-005 → TOK-CUS-A91F"""
    if not raw_id:
        return raw_id
    if raw_id not in _token_cache:
        hash4 = hashlib.sha1(raw_id.encode()).hexdigest()[:4].upper()
        type_part = raw_id.split("-")[0] if "-" in raw_id else "GEN"
        _token_cache[raw_id] = f"{prefix}-{type_part}-{hash4}"
    return _token_cache[raw_id]

def mask_amount(amount: float) -> str:
    """4_200_000_000 → '~4.2B band'"""
    if amount >= 1_000_000_000:
        return f"~{amount/1_000_000_000:.1f}B band"
    elif amount >= 1_000_000:
        return f"~{amount/1_000_000:.0f}M band"
    return f"~{amount:,.0f}"

def mask_payload_for_openai(payload: dict) -> dict:
    """Mask toàn bộ trường sensitive trước khi gửi OpenAI"""
    MASK_KEYS = {"customer_id", "account_id", "counterparty_id", "company_id"}
    BAND_KEYS = {"contract_value", "requested_amount", "projected_closing_cash",
                 "invoice_amount", "amount"}
    SECRET_KEYS = {"api_key", "access_token", "password"}

    def _mask(obj):
        if isinstance(obj, dict):
            return {
                k: "[SECRET]" if k in SECRET_KEYS
                   else tokenize_id(str(v)) if k in MASK_KEYS and v
                   else mask_amount(float(v)) if k in BAND_KEYS and v
                   else _mask(v)
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [_mask(i) for i in obj]
        return obj

    return _mask(payload)
```

---

## 5. PYDANTIC MODELS (models/)

### models/financial.py
```python
from pydantic import BaseModel
from typing import Optional, Literal

class MonthlyGap(BaseModel):
    month: str
    expected_cash_in: float
    expected_cash_out: float
    projected_closing_cash: float
    vs_reserve_minimum: float          # closing - 550M
    status: Literal["OK", "WARNING", "CRITICAL"]

class FundingNeed(BaseModel):
    need_type: str                     # "working_capital" | "performance_bond" | "trade_finance"
    estimated_amount: float
    urgency: Literal["immediate", "within_30d", "within_90d"]
    linked_contract: Optional[str] = None

class FinancialProposal(BaseModel):
    """Output của Data & Finance Agent"""
    agent: str = "Data & Finance Agent"
    target_contract_id: str
    gross_margin_actual: float
    gross_margin_ok: bool
    receivable_total_open: float
    receivable_total_pipeline: float
    monthly_gaps: list[MonthlyGap]
    total_funding_gap_3m: float       # Tổng âm 3 tháng
    funding_needs: list[FundingNeed]
    suspicious_txn_ids: list[str]     # Danh sách TXN cần Crisis Layer
    missing_data_fields: list[str]
    narrative: str                    # OpenAI generated
    data_confidence: Literal["Verified", "Estimated", "Partial"]
```

### models/risk.py
```python
from pydantic import BaseModel
from typing import Optional, Literal

class RiskAlert(BaseModel):
    alert_id: str
    rule_id: str
    related_record: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    risk_score: float
    description: str
    recommended_action: str
    requires_human_approval: bool
    action_taken: Optional[str] = None

class RiskAssessment(BaseModel):
    """Output của Risk & Compliance Agent"""
    agent: str = "Risk & Compliance Agent"
    overall_risk_level: Literal["Critical", "High", "Medium", "Low", "OK"]
    alerts: list[RiskAlert]
    pipeline_should_continue: bool     # False nếu có Critical chưa xử lý
    required_human_approvals: list[str]  # Danh sách hành động cần approve
    narrative: str                      # OpenAI generated
    blocked_by: Optional[str] = None   # Lý do dừng pipeline nếu blocked
```

### models/decision.py
```python
from pydantic import BaseModel
from typing import Optional, Literal

class BankOption(BaseModel):
    bank: str
    product_name: str
    product_id: str
    credit_case_id: str
    request_type: str
    amount_band: str
    annual_rate: Optional[float] = None
    eligibility_score: float
    fit_reason: str
    requires_human_approval: bool = True

class DecisionCard(BaseModel):
    """Output của Decision & Partner Agent — Input cho UI"""
    agent: str = "Decision & Partner Agent"
    contract_id: str
    recommendation: Literal["KY", "KY_CO_DIEU_KIEN", "KHONG_KY", "CHUA_DU_DATA"]
    confidence_score: float
    reasons: list[str]                  # Đúng 3 lý do
    bank_options: list[BankOption]      # Có thể 0, 1, hoặc nhiều
    preconditions: list[str]            # Điều kiện tiên quyết
    human_approval_required: bool = True
    approval_checklist: list[str]       # Checklist cho founder
    narrative: str                      # OpenAI generated
    no_recommendation_reason: Optional[str] = None

class CrisisAlert(BaseModel):
    """Output của Crisis Layer"""
    txn_ids: list[str]
    risk_scores: dict[str, float]
    action: Literal["HOLD_PENDING_APPROVAL", "RELEASED", "PENDING"]
    founder_notified: bool
    requires_immediate_action: bool = True
    description: str
```

### models/agent_log.py
```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AgentLog(BaseModel):
    log_id: str
    agent_name: str
    task_id: str
    timestamp: str = str(datetime.utcnow())
    input_source: list[str]             # Sheets/APIs used
    output_summary: str
    openai_call_id: Optional[str] = None
    masked_fields: list[str]            # Fields đã mask trước OpenAI
    human_approval_required: bool
    pipeline_status: str                # "completed" | "blocked" | "feedback_loop"
```

---

## 6. OPENAI ENGINE (openai_engine/)

### openai_engine/client.py
```python
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
_client = None

def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in .env")
        _client = OpenAI(api_key=api_key)
    return _client

def call_openai(system_prompt: str, user_content: str, agent_name: str) -> tuple[str, str]:
    """
    Returns: (response_text, call_id)
    KHÔNG log user_content nếu chứa dữ liệu — chỉ log agent_name + call_id
    """
    client = get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,
        max_tokens=1000,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content}
        ]
    )
    call_id = response.id
    text = response.choices[0].message.content.strip()
    # LOG chỉ call_id và agent, KHÔNG log content
    print(f"[OpenAI] agent={agent_name} call_id={call_id}")
    return text, call_id
```

### openai_engine/prompts.py
```python
# ── SYSTEM PROMPTS ────────────────────────────────────────────────────

DFA_SYSTEM = """
Bạn là Data & Finance Agent của OPC — một One Person Company chuyên cung cấp giải pháp số cho SME, hộ kinh doanh và hợp tác xã.
Nhiệm vụ của bạn: phân tích dữ liệu tài chính và diễn giải bằng ngôn ngữ nghiệp vụ tiếng Việt dễ hiểu cho nhà sáng lập.

NGUYÊN TẮC:
- Trả lời NGẮN GỌN, tập trung vào ý nghĩa kinh doanh (không chỉ liệt kê số)
- Khi closing_cash < 550M VND bất kỳ tháng nào → đây là rủi ro nghiêm trọng
- Khi gross_margin < 0.28 → cần cảnh báo
- Nếu dữ liệu thiếu → nói rõ thiếu gì, đừng đoán
- Không tạo ra số liệu không có trong input
- Output bằng tiếng Việt, tối đa 200 từ
"""

DFA_USER_TEMPLATE = """
Phân tích tình trạng tài chính OPC và tác động khi nhận hợp đồng {contract_id}:

CASHFLOW 6 THÁNG:
{cashflow_summary}

HỢP ĐỒNG MỤC TIÊU:
- ID: {contract_id}
- Giá trị: {contract_value_band}
- Gross margin hiện tại: {gross_margin}
- Trạng thái: {contract_status}

HÓA ĐƠN ĐANG MỞ: {receivables_open_band}
PIPELINE CHƯA XUẤT: {receivables_pipeline_band}

GIAO DỊCH ĐÁNG NGỜ: {suspicious_txns}

Hãy viết 1 đoạn tóm tắt tình trạng tài chính và 1 đoạn về tác động nếu nhận hợp đồng này.
"""

# ─────────────────────────────────────────────────────────────────────

RCA_SYSTEM = """
Bạn là Risk & Compliance Agent của OPC.
Nhiệm vụ: đánh giá rủi ro dựa trên các quy tắc có sẵn và giải thích bằng tiếng Việt.

QUY TẮC CỨNG (KHÔNG ĐƯỢC THAY ĐỔI):
- RR-001: transaction_risk_score >= 85 → Critical, hold + founder approval
- RR-002: closing_cash < 550M → High, cần working capital
- RR-003: gross_margin < 0.28 → Medium, review giá/chi phí
- RR-004: gửi document ra ngoài → High, cần approval
- RR-005: khoản > 300M → High, cần approval
- RR-006: confidence < 0.65 → Medium, không đủ data → no-recommendation
- RR-007: trễ hơn 7 ngày → High, escalate vận hành

NGUYÊN TẮC:
- Chỉ áp dụng rule có sẵn, không tạo rule mới
- Giải thích edge case khi tình huống không khớp 100% rule
- Nếu có Critical → khuyến nghị DỪNG pipeline chờ founder
- Output tiếng Việt, tối đa 200 từ
"""

RCA_USER_TEMPLATE = """
Đánh giá rủi ro cho OPC dựa trên:

ĐẦU RA TÀI CHÍNH (từ Data Agent):
{financial_summary}

GIAO DỊCH BẤT THƯỜNG:
{suspicious_txns}

CẢNH BÁO HIỆN TẠI:
{existing_alerts}

HỢP ĐỒNG MỤC TIÊU: {contract_id}
- Cần performance bond: {needs_bond}
- Tình trạng chứng từ: {doc_status}

Hãy: (1) liệt kê các rủi ro theo mức độ severity, (2) giải thích lý do, (3) nêu rõ những việc bắt buộc cần founder xác nhận.
"""

# ─────────────────────────────────────────────────────────────────────

DPA_SYSTEM = """
Bạn là Decision & Partner Agent của OPC.
Nhiệm vụ: tổng hợp thông tin tài chính + rủi ro → đưa ra khuyến nghị về việc ký hợp đồng và lựa chọn đối tác tài chính.

LOGIC CHỌN ĐỐI TÁC:
- VietinBank: phù hợp khi cần performance bond (BANKPROD-002), working capital lớn (>500M, BANKPROD-004), trade finance (BANKPROD-003). Target: SME/Enterprise.
- CoopBank: phù hợp khi khách hàng là hợp tác xã/hộ KD, khoản nhỏ (<300M, BANKPROD-006), thu hộ địa phương (BANKPROD-005).
- Có thể kết hợp cả hai: VietinBank cash management + CoopBank thu hộ tỉnh.
- KHÔNG khuyến nghị khi: eligibility_score < 0.65 HOẶC thiếu chứng từ quan trọng.

OUTPUT BẮT BUỘC:
- Recommendation: KY | KY_CO_DIEU_KIEN | KHONG_KY | CHUA_DU_DATA
- Đúng 3 lý do (không ít hơn, không nhiều hơn)
- Confidence score (0-1)
- Điều kiện tiên quyết nếu có
- Tiếng Việt, tối đa 300 từ
"""

DPA_USER_TEMPLATE = """
Tổng hợp và đưa ra khuyến nghị cho OPC:

TÓM TẮT TÀI CHÍNH:
{financial_narrative}

TÓM TẮT RỦI RO:
{risk_narrative}
Overall risk: {overall_risk}

CÁC PHƯƠNG ÁN TÍN DỤNG KHẢ DỤNG:
{credit_options}

THÔNG TIN HỢP ĐỒNG MỤC TIÊU:
- ID: {contract_id}, Giá trị: {contract_value_band}
- Margin: {gross_margin} (target: 28%)
- Loại: {contract_type}

CÁC SẢN PHẨM NGÂN HÀNG PHÙ HỢP:
{bank_products}

Hãy đưa ra: (1) khuyến nghị rõ ràng, (2) đúng 3 lý do, (3) confidence score, (4) điều kiện tiên quyết, (5) ai phải xác nhận gì.
"""
```

### openai_engine/validator.py
```python
"""
Back-check: so sánh output OpenAI với dữ liệu nguồn.
Đây là cơ chế chống hallucination.
"""

def validate_financial_narrative(narrative: str, cashflow_records: list[dict]) -> dict:
    """
    Kiểm tra narrative từ DFA có khớp với số liệu thực không.
    Returns: {"ok": bool, "flags": list[str]}
    """
    flags = []
    # Lấy danh sách tháng âm từ data thực
    negative_months = [
        r["month"] for r in cashflow_records
        if float(r.get("projected_closing_cash", 0)) < 0
    ]
    for month in negative_months:
        short = month[-5:]  # "06-01" -> tháng 6
        if short[:2] in narrative or month in narrative:
            pass  # Đề cập đúng tháng âm
        # Không cần reject nếu không đề cập, chỉ flag nếu sai số liệu
    
    # Kiểm tra số liệu cứng: nếu có số không tồn tại trong data
    if "1 tỷ" in narrative and not any(
        float(r.get("projected_closing_cash", 0)) >= 1_000_000_000
        for r in cashflow_records
    ):
        flags.append("Narrative mentions 1B closing cash but data shows no such month")
    
    return {"ok": len(flags) == 0, "flags": flags}

def validate_recommendation(decision_card: dict) -> dict:
    """
    Kiểm tra confidence score và recommendation nhất quán.
    """
    flags = []
    confidence = decision_card.get("confidence_score", 0)
    recommendation = decision_card.get("recommendation", "")
    
    if confidence < 0.65 and recommendation not in ("CHUA_DU_DATA", "KHONG_KY"):
        flags.append(f"confidence={confidence} < 0.65 but recommendation is {recommendation}")
    
    if len(decision_card.get("reasons", [])) != 3:
        flags.append("reasons must be exactly 3 items")
    
    return {"ok": len(flags) == 0, "flags": flags}
```

---

## 7. MOCK API LAYER (mock_api/)

### mock_api/vietinbank.py
```python
"""
Mock VietinBank APIs theo 12_API_CATALOG.
KHÔNG kết nối ngân hàng thật. Trả về static data.
"""

from data.masking import tokenize_id

def get_account_statement(account_id: str, from_date: str, to_date: str) -> dict:
    """Mock API-001: GET /openapi/v1/accounts/{account_id}/statement"""
    tok = tokenize_id(account_id)
    return {
        "api_id": "API-001",
        "provider": "VietinBank",
        "status": "mock_success",
        "account_id": tok,
        "from_date": from_date,
        "to_date": to_date,
        "transactions": [
            # Lấy từ 08_BANK_TXN, account OPC_MAIN
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
    """Mock API-002: POST /openapi/v1/guarantee/precheck — REQUIRES human approval"""
    return {
        "api_id": "API-002",
        "provider": "VietinBank",
        "status": "mock_pending_human_approval",
        "contract_id": contract_id,
        "amount_band": f"~{amount/1_000_000:.0f}M",
        "eligibility_precheck": "conditional",
        "conditions": ["Contract CON-004 must be signed", "Cashflow buffer confirmation required"],
        "requires_human_approval": True,
        "bank_product": "BANKPROD-002",
        "note": "MOCK — human_approval bắt buộc trước khi submit thật"
    }

def precheck_trade_finance(contract_id: str, amount: float, docs_complete: bool) -> dict:
    """Mock API-003: POST /openapi/v1/trade-finance/precheck"""
    if not docs_complete:
        return {
            "api_id": "API-003",
            "status": "blocked_missing_docs",
            "reason": "supplier_confirmation is NULL — cannot proceed (API-H-002)",
            "requires_human_approval": True,
            "action_required": "Request supplier confirmation from CUS-008"
        }
    return {
        "api_id": "API-003",
        "provider": "VietinBank",
        "status": "mock_pending_human_approval",
        "contract_id": contract_id,
        "amount_band": f"~{amount/1_000_000:.0f}M",
        "bank_product": "BANKPROD-003",
        "requires_human_approval": True
    }
```

### mock_api/coopbank.py
```python
"""Mock CoopBank APIs theo 12_API_CATALOG"""

from data.masking import tokenize_id

def get_cooperative_profile(customer_id: str) -> dict:
    """Mock API-004: GET /sandbox/v1/cooperative/profile/{customer_id}"""
    tok = tokenize_id(customer_id)
    profiles = {
        "CUS-005": {
            "tok": tok,
            "customer_type": "Cooperative",
            "payment_reliability": 0.83,
            "banking_relationship": "CoopBank primary",
            "local_presence": "Cần Thơ + 5 tỉnh đồng bằng"
        }
    }
    return {
        "api_id": "API-004",
        "provider": "CoopBank",
        "status": "mock_success",
        "data": profiles.get(customer_id, {"tok": tok, "status": "no_profile"}),
        "note": "MOCK DATA"
    }

def precheck_micro_credit(customer_type: str, amount: float, receivables: list) -> dict:
    """Mock API-005: POST /sandbox/v1/micro-credit/precheck"""
    return {
        "api_id": "API-005",
        "provider": "CoopBank",
        "status": "mock_pending_human_approval",
        "customer_type": customer_type,
        "amount_band": f"~{amount/1_000_000:.0f}M",
        "eligibility": "good_fit" if customer_type in ("Cooperative", "Household") else "review_needed",
        "bank_product": "BANKPROD-006",
        "requires_human_approval": True,
        "note": "MOCK — CR-004 scenario"
    }

def confirm_suspicious_transaction_hold(txn_ids: list, action: str = "temporary_hold") -> dict:
    """Mock API-006: POST /sandbox/v1/transaction-alert/confirm — REQUIRES founder approval"""
    return {
        "api_id": "API-006",
        "provider": "CoopBank",
        "status": "PENDING_FOUNDER_APPROVAL",
        "txn_ids": txn_ids,
        "action": action,
        "message": "Hành động này không thể đảo ngược. Chờ founder xác nhận (API-H-003).",
        "requires_human_approval": True,
        "irreversible": True
    }
```

---

## 8. AGENT IMPLEMENTATIONS (agents/)

### agents/base_agent.py
```python
from abc import ABC, abstractmethod
from models.agent_log import AgentLog
from openai_engine.client import call_openai
from data.masking import mask_payload_for_openai
import uuid, datetime

class BaseAgent(ABC):
    name: str = "BaseAgent"
    task_id: str = "TASK-000"

    def log(self, input_source: list, output_summary: str,
            openai_call_id: str = None, masked_fields: list = None,
            human_approval_required: bool = False,
            pipeline_status: str = "completed") -> AgentLog:
        return AgentLog(
            log_id=str(uuid.uuid4())[:8],
            agent_name=self.name,
            task_id=self.task_id,
            timestamp=str(datetime.datetime.utcnow()),
            input_source=input_source or [],
            output_summary=output_summary,
            openai_call_id=openai_call_id,
            masked_fields=masked_fields or [],
            human_approval_required=human_approval_required,
            pipeline_status=pipeline_status
        )

    def safe_openai_call(self, system: str, user: str) -> tuple[str, str]:
        """Mask payload TRƯỚC KHI gửi OpenAI"""
        return call_openai(system, user, self.name)

    @abstractmethod
    def run(self, context: dict) -> dict:
        """Returns: {"output": <Pydantic model>, "log": AgentLog}"""
        pass
```

### agents/dfa.py
```python
"""
Data & Finance Agent (TASK-001)
Input:  04_CONTRACTS, 06_ORDERS, 07_INVOICES, 08_BANK_TXN, 09_CASHFLOW
Output: FinancialProposal
"""

from agents.base_agent import BaseAgent
from models.financial import FinancialProposal, MonthlyGap, FundingNeed
from data import loader
from data.masking import mask_payload_for_openai, mask_amount, tokenize_id
from openai_engine.prompts import DFA_SYSTEM, DFA_USER_TEMPLATE
from openai_engine.validator import validate_financial_narrative
from config import CASH_RESERVE_MINIMUM, TARGET_GROSS_MARGIN, TARGET_CONTRACT_ID, TRANSACTION_RISK_CRITICAL
import json

class DataFinanceAgent(BaseAgent):
    name = "Data & Finance Agent"
    task_id = "TASK-001"

    def run(self, context: dict) -> dict:
        contract_id = context.get("contract_id", TARGET_CONTRACT_ID)
        
        # ── 1. Load data ──────────────────────────────────────────
        cashflow    = loader.get_cashflow()
        contracts   = loader.get_contracts()
        orders      = loader.get_orders()
        invoices    = loader.get_invoices()
        bank_txn    = loader.get_bank_txn()

        # ── 2. Tìm contract mục tiêu ──────────────────────────────
        target_contract = next((c for c in contracts if c["contract_id"] == contract_id), {})
        gross_margin = float(target_contract.get("gross_margin", 0))

        # ── 3. Tính monthly gaps ──────────────────────────────────
        monthly_gaps = []
        total_gap_negative = 0.0
        for row in cashflow:
            closing = float(row.get("projected_closing_cash", 0))
            gap = closing - CASH_RESERVE_MINIMUM
            if closing < 0:
                total_gap_negative += abs(closing)
            status = "CRITICAL" if closing < 0 else ("WARNING" if gap < 0 else "OK")
            monthly_gaps.append(MonthlyGap(
                month=row["month"],
                expected_cash_in=float(row.get("expected_cash_in", 0)),
                expected_cash_out=float(row.get("expected_cash_out", 0)),
                projected_closing_cash=closing,
                vs_reserve_minimum=gap,
                status=status
            ))

        # ── 4. Receivables ────────────────────────────────────────
        receivable_open = sum(
            float(inv.get("invoice_amount", 0))
            for inv in invoices if inv.get("status") == "Open"
        )
        receivable_pipeline = sum(
            float(inv.get("invoice_amount", 0))
            for inv in invoices if inv.get("status") == "Not issued"
        )

        # ── 5. Suspicious TXN ─────────────────────────────────────
        suspicious_txns = [
            t["txn_id"] for t in bank_txn
            if float(t.get("transaction_risk_score", 0)) >= TRANSACTION_RISK_CRITICAL
        ]

        # ── 6. Funding needs ──────────────────────────────────────
        funding_needs = []
        if total_gap_negative > 0:
            funding_needs.append(FundingNeed(
                need_type="working_capital",
                estimated_amount=total_gap_negative,
                urgency="immediate",
                linked_contract=contract_id
            ))
        if "performance bond" in target_contract.get("payment_terms", "").lower():
            funding_needs.append(FundingNeed(
                need_type="performance_bond",
                estimated_amount=420_000_000,  # CR-002
                urgency="within_30d",
                linked_contract=contract_id
            ))

        # ── 7. OpenAI narrative ───────────────────────────────────
        cashflow_summary_masked = mask_payload_for_openai({
            "months": [
                {"month": g.month, "closing": g.projected_closing_cash, "status": g.status}
                for g in monthly_gaps
            ]
        })
        user_prompt = DFA_USER_TEMPLATE.format(
            contract_id=contract_id,
            contract_value_band=mask_amount(float(target_contract.get("contract_value", 0))),
            gross_margin=gross_margin,
            contract_status=target_contract.get("status", ""),
            cashflow_summary=json.dumps(cashflow_summary_masked, ensure_ascii=False),
            receivables_open_band=mask_amount(receivable_open),
            receivables_pipeline_band=mask_amount(receivable_pipeline),
            suspicious_txns=suspicious_txns or "None"
        )
        narrative, call_id = self.safe_openai_call(DFA_SYSTEM, user_prompt)

        # ── 8. Back-check ─────────────────────────────────────────
        check = validate_financial_narrative(narrative, cashflow)
        if not check["ok"]:
            narrative += f"\n[SYSTEM WARNING: back-check flags: {check['flags']}]"

        # ── 9. Build output ───────────────────────────────────────
        result = FinancialProposal(
            target_contract_id=contract_id,
            gross_margin_actual=gross_margin,
            gross_margin_ok=(gross_margin >= TARGET_GROSS_MARGIN),
            receivable_total_open=receivable_open,
            receivable_total_pipeline=receivable_pipeline,
            monthly_gaps=monthly_gaps,
            total_funding_gap_3m=total_gap_negative,
            funding_needs=funding_needs,
            suspicious_txn_ids=suspicious_txns,
            missing_data_fields=[],
            narrative=narrative,
            data_confidence="Verified"
        )

        agent_log = self.log(
            input_source=["09_CASHFLOW","04_CONTRACTS","07_INVOICES","08_BANK_TXN"],
            output_summary=f"gap_3m={total_gap_negative:,.0f} margin={gross_margin} suspicious={suspicious_txns}",
            openai_call_id=call_id,
            masked_fields=["contract_value", "invoice_amount", "amount"],
            human_approval_required=False,
            pipeline_status="completed"
        )

        return {"output": result, "log": agent_log}
```

### agents/rca.py
```python
"""
Risk & Compliance Agent (TASK-002)
Input:  FinancialProposal + 08_BANK_TXN + 13_RISK_RULES + 14_ALERTS
Output: RiskAssessment
"""

from agents.base_agent import BaseAgent
from models.risk import RiskAssessment, RiskAlert
from models.financial import FinancialProposal
from data import loader
from data.masking import mask_payload_for_openai
from openai_engine.prompts import RCA_SYSTEM, RCA_USER_TEMPLATE
from config import (CASH_RESERVE_MINIMUM, TARGET_GROSS_MARGIN,
                    HUMAN_APPROVAL_THRESHOLD, TRANSACTION_RISK_CRITICAL,
                    CONFIDENCE_THRESHOLD, DELIVERY_DELAY_MAX_DAYS)
import json

class RiskComplianceAgent(BaseAgent):
    name = "Risk & Compliance Agent"
    task_id = "TASK-002"

    def run(self, context: dict) -> dict:
        financial: FinancialProposal = context["financial_proposal"]
        contract_id = financial.target_contract_id

        risk_rules  = loader.get_risk_rules()
        alerts_raw  = loader.get_alerts()
        bank_txn    = loader.get_bank_txn()
        orders      = loader.get_orders()
        credit      = loader.get_credit_profile()

        alerts: list[RiskAlert] = []
        required_approvals: list[str] = []

        # ── RR-001: Transaction anomaly ──────────────────────────
        for txn in bank_txn:
            score = float(txn.get("transaction_risk_score", 0))
            if score >= TRANSACTION_RISK_CRITICAL:
                alerts.append(RiskAlert(
                    alert_id=f"AL-TXN-{txn['txn_id']}",
                    rule_id="RR-001",
                    related_record=txn["txn_id"],
                    severity="Critical",
                    risk_score=score,
                    description=f"Suspicious TXN {txn['txn_id']}: {txn.get('description','')} risk={score}",
                    recommended_action="Hold immediately + founder confirmation required (API-H-003)",
                    requires_human_approval=True
                ))
                required_approvals.append(f"HOLD_{txn['txn_id']}_founder_confirm")

        # ── RR-002: Cash reserve breach ──────────────────────────
        for gap in financial.monthly_gaps:
            if gap.projected_closing_cash < CASH_RESERVE_MINIMUM:
                alerts.append(RiskAlert(
                    alert_id=f"AL-CASH-{gap.month}",
                    rule_id="RR-002",
                    related_record=f"CASHFLOW_{gap.month}",
                    severity="High",
                    risk_score=76,
                    description=f"Tháng {gap.month}: closing cash {gap.projected_closing_cash:,.0f} dưới mức tối thiểu 550M",
                    recommended_action="Xem xét working capital hoặc giãn tiến độ giao hàng",
                    requires_human_approval=False
                ))

        # ── RR-003: Margin below target ──────────────────────────
        if not financial.gross_margin_ok:
            alerts.append(RiskAlert(
                alert_id="AL-MARGIN-001",
                rule_id="RR-003",
                related_record=contract_id,
                severity="Medium",
                risk_score=55,
                description=f"Gross margin {financial.gross_margin_actual:.0%} < target {TARGET_GROSS_MARGIN:.0%}",
                recommended_action="Review giá hoặc cắt giảm chi phí",
                requires_human_approval=False
            ))

        # ── RR-005: Large financial decision ─────────────────────
        for cr in credit:
            amount = float(cr.get("requested_amount", 0))
            if amount > HUMAN_APPROVAL_THRESHOLD:
                alerts.append(RiskAlert(
                    alert_id=f"AL-LARGE-{cr['credit_case_id']}",
                    rule_id="RR-005",
                    related_record=cr["credit_case_id"],
                    severity="High",
                    risk_score=80,
                    description=f"{cr['credit_case_id']}: requested {amount:,.0f} VND > 300M threshold",
                    recommended_action="Bắt buộc founder ký duyệt trước khi submit",
                    requires_human_approval=True
                ))
                required_approvals.append(f"APPROVE_{cr['credit_case_id']}_before_submission")

        # ── RR-006: Missing doc (CR-003) ─────────────────────────
        for cr in credit:
            if "Missing" in cr.get("precheck_note", "") or cr.get("approval_status") == "Review":
                alerts.append(RiskAlert(
                    alert_id=f"AL-DOC-{cr['credit_case_id']}",
                    rule_id="RR-006",
                    related_record=cr["credit_case_id"],
                    severity="Medium",
                    risk_score=58,
                    description=f"Thiếu chứng từ cho {cr['credit_case_id']}: {cr.get('precheck_note','')}",
                    recommended_action="Yêu cầu bổ sung chứng từ — không đưa ra khuyến nghị tín dụng này",
                    requires_human_approval=False
                ))

        # ── RR-007: Delivery delay ────────────────────────────────
        for order in orders:
            if order.get("status") == "At risk":
                alerts.append(RiskAlert(
                    alert_id=f"AL-DEL-{order['order_id']}",
                    rule_id="RR-007",
                    related_record=order["order_id"],
                    severity="High",
                    risk_score=72,
                    description=f"{order['order_id']}: {order.get('delivery_note','')}",
                    recommended_action="Escalate kế hoạch vận hành, kiểm tra nhà thầu",
                    requires_human_approval=False
                ))

        # ── Overall risk level ────────────────────────────────────
        severities = [a.severity for a in alerts]
        if "Critical" in severities:
            overall = "Critical"
            pipeline_ok = False   # DỪNG pipeline
        elif "High" in severities:
            overall = "High"
            pipeline_ok = True
        elif "Medium" in severities:
            overall = "Medium"
            pipeline_ok = True
        else:
            overall = "OK"
            pipeline_ok = True

        # ── OpenAI narrative ──────────────────────────────────────
        existing_alerts_masked = mask_payload_for_openai(
            {"alerts": [{"id": a.alert_id, "severity": a.severity, "desc": a.description} for a in alerts]}
        )
        credit_masked = mask_payload_for_openai(
            {"credit": [{"id": c["credit_case_id"], "type": c["request_type"],
                         "note": c["precheck_note"], "status": c["approval_status"]}
                        for c in credit]}
        )
        user_prompt = RCA_USER_TEMPLATE.format(
            financial_summary=financial.narrative[:400],
            suspicious_txns=financial.suspicious_txn_ids or "None",
            existing_alerts=json.dumps(existing_alerts_masked, ensure_ascii=False),
            contract_id=contract_id,
            needs_bond="Yes (CR-002, 420M)" if any("performance" in fn.need_type for fn in financial.funding_needs) else "No",
            doc_status=json.dumps(credit_masked, ensure_ascii=False)
        )
        narrative, call_id = self.safe_openai_call(RCA_SYSTEM, user_prompt)

        # ── Pipeline decision ─────────────────────────────────────
        blocked_by = None
        if not pipeline_ok:
            blocked_by = f"Critical alerts present: {[a.alert_id for a in alerts if a.severity=='Critical']}"

        result = RiskAssessment(
            overall_risk_level=overall,
            alerts=alerts,
            pipeline_should_continue=pipeline_ok,
            required_human_approvals=required_approvals,
            narrative=narrative,
            blocked_by=blocked_by
        )

        agent_log = self.log(
            input_source=["08_BANK_TXN","13_RISK_RULES","14_ALERTS","10_CREDIT_PROFILE"],
            output_summary=f"overall={overall} alerts={len(alerts)} pipeline_ok={pipeline_ok}",
            openai_call_id=call_id,
            masked_fields=["txn_id","credit_case_id","customer_id"],
            human_approval_required=len(required_approvals) > 0,
            pipeline_status="completed" if pipeline_ok else "blocked"
        )

        return {"output": result, "log": agent_log}
```

### agents/dpa.py
```python
"""
Decision & Partner Agent (TASK-003)
Input:  FinancialProposal + RiskAssessment + 10_CREDIT_PROFILE + 11_BANK_PRODUCTS
Output: DecisionCard
"""

from agents.base_agent import BaseAgent
from models.decision import DecisionCard, BankOption
from models.financial import FinancialProposal
from models.risk import RiskAssessment
from data import loader
from data.masking import mask_payload_for_openai, mask_amount
from openai_engine.prompts import DPA_SYSTEM, DPA_USER_TEMPLATE
from openai_engine.validator import validate_recommendation
from config import CONFIDENCE_THRESHOLD
import json, uuid

class DecisionPartnerAgent(BaseAgent):
    name = "Decision & Partner Agent"
    task_id = "TASK-003"

    def _calc_confidence(self, credit_case: dict, doc_complete: bool) -> float:
        base = float(credit_case.get("eligibility_score", 0))
        completeness = 1.0 if doc_complete else 0.5
        return round(base * completeness, 2)

    def run(self, context: dict) -> dict:
        financial: FinancialProposal = context["financial_proposal"]
        risk: RiskAssessment         = context["risk_assessment"]
        contract_id = financial.target_contract_id

        credit_profiles = loader.get_credit_profile()
        bank_products   = loader.get_bank_products()
        contracts       = loader.get_contracts()
        customers       = loader.get_customers()

        target_contract = next((c for c in contracts if c["contract_id"] == contract_id), {})
        cus_id = target_contract.get("customer_id", "")
        target_customer = next((c for c in customers if c["customer_id"] == cus_id), {})
        customer_type = target_customer.get("customer_type", "")

        # ── Xây dựng bank options ────────────────────────────────
        bank_options: list[BankOption] = []
        blocked_cases: list[str] = []

        for cr in credit_profiles:
            doc_complete = "Missing" not in cr.get("precheck_note", "")
            confidence = self._calc_confidence(cr, doc_complete)

            if confidence < CONFIDENCE_THRESHOLD or not doc_complete:
                blocked_cases.append(cr["credit_case_id"])
                continue  # No-recommendation cho case này

            # Match với bank product
            req_type = cr.get("request_type", "")
            amount   = float(cr.get("requested_amount", 0))
            status   = cr.get("approval_status", "")

            matched_product = None
            if "performance bond" in req_type.lower():
                matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-002"), None)
            elif "working capital" in req_type.lower() and "micro" not in req_type.lower():
                # VietinBank nếu lớn, CoopBank nếu nhỏ + cooperative
                if amount > 500_000_000 or customer_type not in ("Cooperative", "Household"):
                    matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-004"), None)
                else:
                    matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-006"), None)
            elif "micro" in req_type.lower():
                matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-006"), None)
            elif "trade finance" in req_type.lower():
                matched_product = next((p for p in bank_products if p["bank_product_id"] == "BANKPROD-003"), None)

            if matched_product:
                bank_options.append(BankOption(
                    bank=matched_product["bank"],
                    product_name=matched_product["product_name"],
                    product_id=matched_product["bank_product_id"],
                    credit_case_id=cr["credit_case_id"],
                    request_type=req_type,
                    amount_band=mask_amount(amount),
                    annual_rate=float(matched_product["annual_rate_or_fee"]) if matched_product.get("annual_rate_or_fee") else None,
                    eligibility_score=confidence,
                    fit_reason=matched_product.get("fit_note", ""),
                    requires_human_approval=True
                ))

        # ── Confidence tổng thể ──────────────────────────────────
        if bank_options:
            overall_confidence = round(sum(o.eligibility_score for o in bank_options) / len(bank_options), 2)
        else:
            overall_confidence = 0.45

        # ── Recommendation ───────────────────────────────────────
        overall_risk = risk.overall_risk_level
        margin_ok    = financial.gross_margin_ok
        has_critical = overall_risk == "Critical"

        if overall_confidence < CONFIDENCE_THRESHOLD and not bank_options:
            recommendation = "CHUA_DU_DATA"
        elif has_critical and not context.get("crisis_resolved", False):
            recommendation = "KY_CO_DIEU_KIEN"
        elif margin_ok and bank_options:
            recommendation = "KY_CO_DIEU_KIEN"
        elif not margin_ok:
            recommendation = "KY_CO_DIEU_KIEN"
        else:
            recommendation = "KY"

        # ── Preconditions ────────────────────────────────────────
        preconditions = []
        if financial.suspicious_txn_ids:
            preconditions.append(f"Xử lý giao dịch đáng ngờ: {financial.suspicious_txn_ids}")
        if not margin_ok:
            preconditions.append(f"Review margin {financial.gross_margin_actual:.0%} → cần đạt ≥28% hoặc đàm phán lại giá")
        if blocked_cases:
            preconditions.append(f"Bổ sung chứng từ cho: {blocked_cases}")
        preconditions.append("CON-004 phải ký chính thức trước khi nộp hồ sơ ngân hàng")

        # Approval checklist
        approval_checklist = [
            "[ ] Founder xác nhận xử lý TXN-006/007 (RR-001 + API-H-003)",
            "[ ] Founder ký duyệt CR-001 (950M > 300M, RR-005)",
            "[ ] Founder ký duyệt CR-002 performance bond (420M > 300M, RR-005)",
            "[ ] Founder xác nhận phase rollout 5 tỉnh trước",
            "[ ] Bổ sung supplier confirmation cho CR-003 trước khi trade finance"
        ]

        # ── OpenAI narrative ──────────────────────────────────────
        credit_masked = mask_payload_for_openai({
            "options": [{"id": o.credit_case_id, "type": o.request_type,
                         "amount": o.amount_band, "score": o.eligibility_score} for o in bank_options]
        })
        products_masked = mask_payload_for_openai({
            "products": [{"bank": o.bank, "product": o.product_name, "rate": o.annual_rate} for o in bank_options]
        })
        user_prompt = DPA_USER_TEMPLATE.format(
            financial_narrative=financial.narrative[:300],
            risk_narrative=risk.narrative[:300],
            overall_risk=overall_risk,
            credit_options=json.dumps(credit_masked, ensure_ascii=False),
            contract_id=contract_id,
            contract_value_band=mask_amount(float(target_contract.get("contract_value", 0))),
            gross_margin=f"{financial.gross_margin_actual:.0%}",
            contract_type=target_contract.get("description", ""),
            bank_products=json.dumps(products_masked, ensure_ascii=False)
        )
        narrative, call_id = self.safe_openai_call(DPA_SYSTEM, user_prompt)

        # ── Extract 3 reasons từ narrative ───────────────────────
        # Đơn giản: lấy 3 dòng đầu của narrative làm reasons
        lines = [l.strip() for l in narrative.split("\n") if l.strip()]
        reasons = lines[:3] if len(lines) >= 3 else (lines + ["[Xem narrative đầy đủ]"] * 3)[:3]

        result = DecisionCard(
            contract_id=contract_id,
            recommendation=recommendation,
            confidence_score=overall_confidence,
            reasons=reasons,
            bank_options=bank_options,
            preconditions=preconditions,
            human_approval_required=True,
            approval_checklist=approval_checklist,
            narrative=narrative,
            no_recommendation_reason=f"Blocked cases: {blocked_cases}" if blocked_cases and not bank_options else None
        )

        # Back-check
        check = validate_recommendation(result.model_dump())
        if not check["ok"]:
            result.narrative += f"\n[SYSTEM WARNING: {check['flags']}]"

        agent_log = self.log(
            input_source=["10_CREDIT_PROFILE","11_BANK_PRODUCTS","12_API_CATALOG"],
            output_summary=f"recommendation={recommendation} confidence={overall_confidence} options={len(bank_options)}",
            openai_call_id=call_id,
            masked_fields=["customer_id","requested_amount","contract_value"],
            human_approval_required=True,
            pipeline_status="completed"
        )

        return {"output": result, "log": agent_log}
```

### agents/crisis_layer.py
```python
"""
Crisis Layer — chạy ĐỘC LẬP với main pipeline.
Phát hiện TXN risk >= 85 và yêu cầu founder xác nhận NGAY.
"""

from models.decision import CrisisAlert
from models.agent_log import AgentLog
from mock_api.coopbank import confirm_suspicious_transaction_hold
from data import loader
from config import TRANSACTION_RISK_CRITICAL
import uuid, datetime

def run_crisis_scan() -> dict:
    """
    Scan BANK_TXN, phát hiện suspicious, trả CrisisAlert.
    Gọi TRƯỚC hoặc SONG SONG với main pipeline.
    """
    bank_txn = loader.get_bank_txn()

    suspicious = [
        t for t in bank_txn
        if float(t.get("transaction_risk_score", 0)) >= TRANSACTION_RISK_CRITICAL
    ]

    if not suspicious:
        return {
            "crisis_detected": False,
            "alert": None,
            "crisis_resolved": False
        }

    txn_ids    = [t["txn_id"] for t in suspicious]
    risk_scores = {t["txn_id"]: float(t["transaction_risk_score"]) for t in suspicious}

    # Gọi mock API-006 (luôn trả về PENDING_FOUNDER_APPROVAL)
    hold_response = confirm_suspicious_transaction_hold(txn_ids, action="temporary_hold")

    alert = CrisisAlert(
        txn_ids=txn_ids,
        risk_scores=risk_scores,
        action="HOLD_PENDING_APPROVAL",
        founder_notified=True,
        requires_immediate_action=True,
        description=(
            f"CRISIS: {len(txn_ids)} giao dịch đáng ngờ phát hiện: {txn_ids}. "
            f"Risk scores: {risk_scores}. "
            f"Đang chờ Founder xác nhận HOLD (không thể đảo ngược — API-H-003)."
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
        masked_fields=["txn_id","account_id"],
        human_approval_required=True,
        pipeline_status="blocked_crisis"
    )

    return {
        "crisis_detected": True,
        "alert": alert,
        "crisis_resolved": False,   # Chờ founder bấm xác nhận
        "hold_api_response": hold_response,
        "log": log
    }
```

---

## 9. MAIN PIPELINE (main.py)

```python
"""
OPC FlowMind — Main Entry Point
Sequential pipeline: DFA → RCA → DPA + Crisis Layer (parallel)
"""

import json
from agents.dfa import DataFinanceAgent
from agents.rca import RiskComplianceAgent
from agents.dpa import DecisionPartnerAgent
from agents.crisis_layer import run_crisis_scan
from output.schema import build_final_output
from config import TARGET_CONTRACT_ID

def run_pipeline(contract_id: str = TARGET_CONTRACT_ID,
                 founder_crisis_resolved: bool = False) -> dict:
    """
    Args:
        contract_id: contract để phân tích (default CON-004)
        founder_crisis_resolved: True nếu founder đã xác nhận xử lý crisis

    Returns: Final JSON output cho UI
    """
    logs = []
    print(f"\n{'='*60}")
    print(f"OPC FlowMind — Phân tích {contract_id}")
    print(f"{'='*60}\n")

    # ── CRISIS LAYER (song song, chạy trước) ──────────────────
    print("[CRISIS LAYER] Scanning suspicious transactions...")
    crisis_result = run_crisis_scan()
    if crisis_result.get("log"):
        logs.append(crisis_result["log"].model_dump())

    if crisis_result["crisis_detected"] and not founder_crisis_resolved:
        print(f"[CRISIS] ⚠️  DỪNG — Crisis detected: {crisis_result['alert'].txn_ids}")
        print("[CRISIS] Chờ Founder xác nhận HOLD trước khi tiếp tục main pipeline.")
        # Vẫn chạy main pipeline nhưng truyền context crisis chưa resolved
        # UI sẽ disable nút Xác nhận nếu crisis chưa resolved

    # ── STAGE 1: Data & Finance Agent ─────────────────────────
    print(f"\n[STAGE 1] Data & Finance Agent đang chạy...")
    dfa = DataFinanceAgent()
    dfa_result = dfa.run({"contract_id": contract_id})
    financial_proposal = dfa_result["output"]
    logs.append(dfa_result["log"].model_dump())
    print(f"[DFA] ✓ margin={financial_proposal.gross_margin_actual:.0%} "
          f"gap_3m={financial_proposal.total_funding_gap_3m:,.0f}")

    # ── STAGE 2: Risk & Compliance Agent ──────────────────────
    print(f"\n[STAGE 2] Risk & Compliance Agent đang chạy...")
    rca = RiskComplianceAgent()
    rca_result = rca.run({"financial_proposal": financial_proposal})
    risk_assessment = rca_result["output"]
    logs.append(rca_result["log"].model_dump())
    print(f"[RCA] ✓ overall={risk_assessment.overall_risk_level} "
          f"alerts={len(risk_assessment.alerts)} pipeline_ok={risk_assessment.pipeline_should_continue}")

    # ── Feedback loop check ────────────────────────────────────
    if not risk_assessment.pipeline_should_continue:
        print(f"\n[PIPELINE] ⚠️  Blocked: {risk_assessment.blocked_by}")
        print("[PIPELINE] Trả feedback loop — yêu cầu bổ sung dữ liệu hoặc founder xử lý Critical.")

    # ── STAGE 3: Decision & Partner Agent ─────────────────────
    print(f"\n[STAGE 3] Decision & Partner Agent đang chạy...")
    dpa = DecisionPartnerAgent()
    dpa_result = dpa.run({
        "financial_proposal": financial_proposal,
        "risk_assessment": risk_assessment,
        "crisis_resolved": founder_crisis_resolved
    })
    decision_card = dpa_result["output"]
    logs.append(dpa_result["log"].model_dump())
    print(f"[DPA] ✓ recommendation={decision_card.recommendation} "
          f"confidence={decision_card.confidence_score}")

    # ── Build final output ─────────────────────────────────────
    final = build_final_output(
        crisis_result=crisis_result,
        financial_proposal=financial_proposal,
        risk_assessment=risk_assessment,
        decision_card=decision_card,
        agent_logs=logs
    )
    print(f"\n[OUTPUT] Hoàn tất. Recommendation: {decision_card.recommendation}")
    return final


if __name__ == "__main__":
    result = run_pipeline(TARGET_CONTRACT_ID)
    print("\n" + "="*60)
    print("FINAL OUTPUT JSON:")
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
```

---

## 10. OUTPUT SCHEMA (output/schema.py)

> Đây là contract giữa agent backend và UI frontend. UI team sẽ consume JSON này.

```python
"""
Final output schema — UI team consume cái này.
"""

def build_final_output(crisis_result, financial_proposal, risk_assessment,
                       decision_card, agent_logs) -> dict:
    """
    Build JSON output chuẩn cho UI (3 zones: Input, Workflow, Decision)
    """
    return {
        "meta": {
            "contract_id": financial_proposal.target_contract_id,
            "generated_at": str(__import__("datetime").datetime.utcnow()),
            "system": "OPC FlowMind v1.0"
        },

        # ── ZONE 1: INPUT DATA ─────────────────────────────────
        "zone_input": {
            "cashflow_chart": [
                {
                    "month": g.month,
                    "cash_in": g.expected_cash_in,
                    "cash_out": g.expected_cash_out,
                    "closing": g.projected_closing_cash,
                    "status": g.status   # "OK" | "WARNING" | "CRITICAL"
                }
                for g in financial_proposal.monthly_gaps
            ],
            "receivables": {
                "open_vnd": financial_proposal.receivable_total_open,
                "pipeline_vnd": financial_proposal.receivable_total_pipeline
            },
            "data_confidence": financial_proposal.data_confidence,
            "missing_fields": financial_proposal.missing_data_fields
        },

        # ── ZONE 2: AGENT WORKFLOW ─────────────────────────────
        "zone_workflow": {
            "crisis_layer": {
                "active": crisis_result["crisis_detected"],
                "resolved": crisis_result.get("crisis_resolved", False),
                "alert": crisis_result["alert"].model_dump() if crisis_result.get("alert") else None
            },
            "pipeline": [
                {
                    "step": 1,
                    "agent": "Data & Finance Agent",
                    "status": "completed",
                    "summary": f"Funding gap 3M: {financial_proposal.total_funding_gap_3m:,.0f} VND | "
                               f"Margin: {financial_proposal.gross_margin_actual:.0%}",
                    "has_warning": not financial_proposal.gross_margin_ok
                },
                {
                    "step": 2,
                    "agent": "Risk & Compliance Agent",
                    "status": "completed" if risk_assessment.pipeline_should_continue else "blocked",
                    "summary": f"Risk: {risk_assessment.overall_risk_level} | "
                               f"{len(risk_assessment.alerts)} alerts",
                    "has_warning": risk_assessment.overall_risk_level in ("Critical", "High"),
                    "blocked_reason": risk_assessment.blocked_by
                },
                {
                    "step": 3,
                    "agent": "Decision & Partner Agent",
                    "status": "completed",
                    "summary": f"Recommendation: {decision_card.recommendation} | "
                               f"Confidence: {decision_card.confidence_score:.0%}",
                    "has_warning": decision_card.confidence_score < 0.65
                }
            ],
            "feedback_loop_triggered": not risk_assessment.pipeline_should_continue
        },

        # ── ZONE 3: DECISION DASHBOARD ─────────────────────────
        "zone_decision": {
            "recommendation": decision_card.recommendation,
            # "KY" | "KY_CO_DIEU_KIEN" | "KHONG_KY" | "CHUA_DU_DATA"

            "confidence_score": decision_card.confidence_score,
            "confidence_ok": decision_card.confidence_score >= 0.65,

            "three_reasons": decision_card.reasons,

            "bank_options": [
                {
                    "bank": opt.bank,
                    "product": opt.product_name,
                    "amount_band": opt.amount_band,
                    "annual_rate": opt.annual_rate,
                    "eligibility_score": opt.eligibility_score,
                    "fit_reason": opt.fit_reason,
                    "requires_approval": opt.requires_human_approval
                }
                for opt in decision_card.bank_options
            ],

            "risk_alerts": [
                {
                    "alert_id": a.alert_id,
                    "severity": a.severity,    # "Critical" | "High" | "Medium"
                    "rule_id": a.rule_id,
                    "description": a.description,
                    "action": a.recommended_action,
                    "requires_human_approval": a.requires_human_approval
                }
                for a in risk_assessment.alerts
            ],

            "preconditions": decision_card.preconditions,

            "approval_checklist": decision_card.approval_checklist,

            # UI logic: disable nút Xác nhận nếu confirm_button_enabled = False
            "confirm_button_enabled": (
                not crisis_result["crisis_detected"]
                or crisis_result.get("crisis_resolved", False)
            ) and risk_assessment.pipeline_should_continue,

            "confirm_button_disabled_reason": (
                "Còn alert Critical chưa xử lý — Founder phải xác nhận HOLD TXN-006/007 trước"
                if crisis_result["crisis_detected"] and not crisis_result.get("crisis_resolved")
                else None
            ),

            "no_recommendation_reason": decision_card.no_recommendation_reason,

            "narrative": decision_card.narrative
        },

        # ── AUDIT ──────────────────────────────────────────────
        "agent_logs": agent_logs
    }
```

---

## 11. SAMPLE OUTPUT JSON (kết quả thực tế với data CON-004)

```json
{
  "meta": {
    "contract_id": "CON-004",
    "system": "OPC FlowMind v1.0"
  },
  "zone_input": {
    "cashflow_chart": [
      {"month":"2026-06","closing":-160000000,"status":"CRITICAL"},
      {"month":"2026-07","closing":-130000000,"status":"CRITICAL"},
      {"month":"2026-08","closing":-155000000,"status":"CRITICAL"},
      {"month":"2026-09","closing": 350000000,"status":"OK"}
    ],
    "receivables": {"open_vnd": 635000000, "pipeline_vnd": 2760000000}
  },
  "zone_decision": {
    "recommendation": "KY_CO_DIEU_KIEN",
    "confidence_score": 0.67,
    "three_reasons": ["[OpenAI generated reason 1]","[reason 2]","[reason 3]"],
    "bank_options": [
      {"bank":"VietinBank","product":"Performance bond","amount_band":"~420M","eligibility_score":0.63},
      {"bank":"CoopBank",  "product":"Micro working capital","amount_band":"~220M","eligibility_score":0.78}
    ],
    "risk_alerts": [
      {"severity":"Critical","rule_id":"RR-001","description":"TXN-006/007 suspicious"},
      {"severity":"High",    "rule_id":"RR-002","description":"3 tháng âm dòng tiền"}
    ],
    "confirm_button_enabled": false,
    "confirm_button_disabled_reason": "Còn alert Critical chưa xử lý — xác nhận HOLD TXN-006/007 trước"
  }
}
```

---

## 12. CHECKLIST BUILD THEO THỨ TỰ

```
[ ] 1. Setup project structure + .env + install dependencies
[ ] 2. Implement data/loader.py — test đọc đủ các sheet
[ ] 3. Implement data/masking.py — test tokenize + band
[ ] 4. Implement models/ (Pydantic) — validate với sample data
[ ] 5. Implement openai_engine/client.py — test call gpt-4o-mini
[ ] 6. Implement openai_engine/prompts.py
[ ] 7. Implement agents/crisis_layer.py (đơn giản nhất)
[ ] 8. Implement agents/dfa.py + test output FinancialProposal
[ ] 9. Implement agents/rca.py + test output RiskAssessment
[ ]10. Implement agents/dpa.py + test output DecisionCard
[ ]11. Implement mock_api/ (VietinBank + CoopBank)
[ ]12. Implement output/schema.py — build_final_output()
[ ]13. Wire main.py — test end-to-end pipeline
[ ]14. Validate JSON output khớp với UI schema
[ ]15. Chạy với CON-004 → ghi lại output làm sample cho UI
```

---

## 13. LƯU Ý QUAN TRỌNG KHI BUILD

### An toàn dữ liệu
- **KHÔNG** log `OPENAI_API_KEY` ra console hoặc file
- **KHÔNG** commit `.env` lên git
- **LUÔN** gọi `mask_payload_for_openai()` trước khi build user prompt
- `AGENT_LOG.masked_fields` phải liệt kê đủ các field đã mask

### Anti-hallucination
- Khi OpenAI trả về số không có trong data → `validate_financial_narrative()` sẽ phát hiện
- Set `temperature=0.3` (không cao hơn) để kết quả ổn định
- Prompt luôn có câu "Nếu dữ liệu thiếu → nói rõ thiếu gì, đừng đoán"

### Human-in-the-loop bắt buộc
- `confirm_button_enabled` trong output JSON phải `False` khi còn Critical alert
- UI không được enable nút Xác nhận khi field này là `False`
- Agent không tự gọi API-006 (hold transaction) mà chỉ chuẩn bị request + chờ

### Governance
- Pipeline KHÔNG dừng hoàn toàn khi có Critical — vẫn chạy đến DPA để sinh Decision Card
- Nhưng `confirm_button_enabled = False` và `recommendation` = `KY_CO_DIEU_KIEN` hoặc `KHONG_KY`
- Log mọi OpenAI call ID để truy ngược

---

## 14. TEST CASES QUAN TRỌNG

```python
# Test 1: TXN-006/007 phải kích hoạt Crisis Layer
crisis = run_crisis_scan()
assert crisis["crisis_detected"] == True
assert "TXN-006" in crisis["alert"].txn_ids
assert crisis["alert"].action == "HOLD_PENDING_APPROVAL"

# Test 2: CR-003 thiếu chứng từ → confidence thấp → no-recommendation cho case này
# (nhưng các case khác vẫn có option)

# Test 3: 3 tháng âm dòng tiền → RR-002 phải tạo ≥ 3 alerts High

# Test 4: confirm_button_enabled phải False khi crisis chưa resolved

# Test 5: Nếu founder_crisis_resolved=True → button enabled
result = run_pipeline(founder_crisis_resolved=True)
assert result["zone_decision"]["confirm_button_enabled"] == True
```

---

*Build spec này đã bao gồm toàn bộ data thực từ Team Pack v3. Chạy `python main.py` để xem output.*
