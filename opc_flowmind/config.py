import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
XLSX_PATH = os.path.join(BASE_DIR, "data", "MISTalent2026_OPC_AgenticAI_TeamPack_v3.xlsx")

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

CASH_RESERVE_MINIMUM        = 550_000_000
TARGET_GROSS_MARGIN         = 0.28
LATE_DELIVERY_PENALTY_RATE  = 0.015
HUMAN_APPROVAL_THRESHOLD    = 300_000_000
TRANSACTION_RISK_CRITICAL   = 85
CONFIDENCE_THRESHOLD        = 0.65
DELIVERY_DELAY_MAX_DAYS     = 7

TARGET_CONTRACT_ID    = "CON-004"
TARGET_CONTRACT_VALUE = 4_200_000_000

OPENAI_MODEL       = "gpt-4o-mini"
OPENAI_TEMPERATURE = 0.3
OPENAI_MAX_TOKENS  = 1000

# FastAPI server config (cho n8n gọi)
API_HOST = "0.0.0.0"
API_PORT = 8000
