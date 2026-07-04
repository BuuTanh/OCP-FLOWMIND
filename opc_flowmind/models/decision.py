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
    agent: str = "Decision & Partner Agent"
    contract_id: str
    recommendation: Literal["KY", "KY_CO_DIEU_KIEN", "KHONG_KY", "CHUA_DU_DATA"]
    confidence_score: float
    reasons: list[str]
    bank_options: list[BankOption]
    preconditions: list[str]
    human_approval_required: bool = True
    approval_checklist: list[str]
    narrative: str
    no_recommendation_reason: Optional[str] = None

class CrisisAlert(BaseModel):
    txn_ids: list[str]
    risk_scores: dict[str, float]
    action: Literal["HOLD_PENDING_APPROVAL", "RELEASED", "PENDING"]
    founder_notified: bool
    requires_immediate_action: bool = True
    description: str
