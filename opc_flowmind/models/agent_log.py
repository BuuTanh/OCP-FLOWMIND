from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AgentLog(BaseModel):
    log_id: str
    agent_name: str
    task_id: str
    timestamp: str = str(datetime.utcnow())
    input_source: list[str]
    output_summary: str
    openai_call_id: Optional[str] = None
    masked_fields: list[str]
    human_approval_required: bool
    pipeline_status: str
