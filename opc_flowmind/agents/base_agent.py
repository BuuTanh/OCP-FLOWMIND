from abc import ABC, abstractmethod
from models.agent_log import AgentLog
from openai_engine.client import call_openai, OPENAI_MODEL
from data.masking import unmask_text
import uuid, datetime, hashlib

class BaseAgent(ABC):
    name: str = "BaseAgent"
    task_id: str = "TASK-000"

    def log(self, input_source: list, output_summary: str,
            openai_call_id: str = None, masked_fields: list = None,
            human_approval_required: bool = False,
            pipeline_status: str = "completed",
            trace_id: str = "", prompt_hash: str = None) -> AgentLog:
        return AgentLog(
            log_id=str(uuid.uuid4())[:8],
            trace_id=trace_id,
            agent_name=self.name,
            task_id=self.task_id,
            timestamp=str(datetime.datetime.utcnow()),
            input_source=input_source or [],
            output_summary=output_summary,
            openai_call_id=openai_call_id,
            openai_service_used=OPENAI_MODEL if openai_call_id else None,
            prompt_hash=prompt_hash,
            masked_fields=masked_fields or [],
            human_approval_required=human_approval_required,
            pipeline_status=pipeline_status
        )

    def safe_openai_call(self, system: str, user: str) -> tuple[str, str, str]:
        """Trả (narrative, openai_call_id, prompt_hash).
        prompt_hash = SHA-256 của system+user, dùng để đối chiếu/kiểm toán mà
        KHÔNG lưu nguyên văn prompt (vốn có thể chứa dữ liệu đã che nhưng vẫn nhạy cảm).
        Phản hồi OpenAI luôn được unmask (token → giá trị gốc) trước khi trả về,
        vì đây là nơi duy nhất mọi agent nhận narrative từ OpenAI."""
        text, call_id = call_openai(system, user, self.name)
        text = unmask_text(text)
        prompt_hash = hashlib.sha256(f"{system}\n{user}".encode("utf-8")).hexdigest()[:16]
        return text, call_id, prompt_hash

    @abstractmethod
    def run(self, context: dict) -> dict:
        pass
