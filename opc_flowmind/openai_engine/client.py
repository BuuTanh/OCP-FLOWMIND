import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
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
    print(f"[OpenAI] agent={agent_name} call_id={call_id}")
    return text, call_id
