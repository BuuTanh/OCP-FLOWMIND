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
    agent: str = "Risk & Compliance Agent"
    overall_risk_level: Literal["Critical", "High", "Medium", "Low", "OK"]
    alerts: list[RiskAlert]
    pipeline_should_continue: bool
    required_human_approvals: list[str]
    narrative: str
    blocked_by: Optional[str] = None
