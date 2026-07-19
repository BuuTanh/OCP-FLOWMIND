import os, time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
_client = None
OPENAI_MODEL = "gpt-4o-mini"

# 22_API_HANDLING_RULES: thử lại tối đa hai lần, có giãn cách tăng dần, trước khi báo lỗi.
MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 2

def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in .env")
        _client = OpenAI(api_key=api_key)
    return _client

def call_openai(system_prompt: str, user_content: str, agent_name: str) -> tuple[str, str]:
    client = get_client()
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 2):  # lần đầu + tối đa 2 lần thử lại
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                temperature=0.3,
                max_tokens=1000,
                timeout=20,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_content}
                ]
            )
            call_id = response.id
            text = response.choices[0].message.content.strip()
            print(f"[OpenAI] agent={agent_name} call_id={call_id}")
            return text, call_id
        except Exception as e:
            last_error = e
            if attempt <= MAX_RETRIES:
                wait = RETRY_BACKOFF_SECONDS * attempt
                print(f"[OpenAI] agent={agent_name} lỗi lần {attempt}: {e} — thử lại sau {wait}s")
                time.sleep(wait)
    print(f"[OpenAI] agent={agent_name} thất bại sau {MAX_RETRIES} lần thử lại: {last_error}")
    raise last_error
