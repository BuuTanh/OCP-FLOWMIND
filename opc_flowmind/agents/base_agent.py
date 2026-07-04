from abc import ABC, abstractmethod
from models.agent_log import AgentLog
from openai_engine.client import call_openai
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
        return call_openai(system, user, self.name)

    @abstractmethod
    def run(self, context: dict) -> dict:
        pass
