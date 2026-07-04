from pydantic import BaseModel
from typing import Optional, Literal

class MonthlyGap(BaseModel):
    month: str
    expected_cash_in: float
    expected_cash_out: float
    projected_closing_cash: float
    vs_reserve_minimum: float
    status: Literal["OK", "WARNING", "CRITICAL"]

class FundingNeed(BaseModel):
    need_type: str
    estimated_amount: float
    urgency: Literal["immediate", "within_30d", "within_90d"]
    linked_contract: Optional[str] = None

class FinancialProposal(BaseModel):
    agent: str = "Data & Finance Agent"
    target_contract_id: str
    gross_margin_actual: float
    gross_margin_ok: bool
    receivable_total_open: float
    receivable_total_pipeline: float
    monthly_gaps: list[MonthlyGap]
    total_funding_gap_3m: float
    funding_needs: list[FundingNeed]
    suspicious_txn_ids: list[str]
    missing_data_fields: list[str]
    narrative: str
    data_confidence: Literal["Verified", "Estimated", "Partial"]
