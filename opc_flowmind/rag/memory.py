"""
Agentic RAG Memory — ChromaDB in-memory.
Mỗi lần phân tích xong → kết quả được embed vào collection "analysis_memory".
Các lần sau → query top-k kết quả tương tự → thêm vào context cho agent.
"""

import json
import time
from typing import Optional

try:
    import chromadb
    from chromadb.utils import embedding_functions
    _CHROMA_AVAILABLE = True
except ImportError:
    _CHROMA_AVAILABLE = False
    print("[RAG] Warning: chromadb not installed. Memory disabled. Run: pip install chromadb")

_client = None
_collection = None

COLLECTION_NAME = "opc_analysis_memory"


def _get_collection():
    global _client, _collection
    if not _CHROMA_AVAILABLE:
        return None
    if _collection is None:
        _client = chromadb.Client()  # in-memory
        ef = embedding_functions.DefaultEmbeddingFunction()
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"}
        )
    return _collection


def store_analysis(contract_id: str, analysis_result: dict) -> bool:
    """
    Sau khi phân tích xong, lưu kết quả vào RAG memory.
    Kết quả này trở thành knowledge cho các phân tích tương lai.
    """
    col = _get_collection()
    if col is None:
        return False

    decision = analysis_result.get("zone_decision", {})
    rec = decision.get("recommendation", "")
    confidence = decision.get("confidence_score", 0)
    reasons = decision.get("three_reasons", [])
    narrative = decision.get("narrative", "")

    # Text để embed — tóm tắt ngắn gọn toàn bộ phân tích
    doc_text = f"""
Contract: {contract_id}
Recommendation: {rec}
Confidence: {confidence}
Reasons: {' | '.join(reasons)}
Narrative: {narrative[:500]}
Risk alerts: {len(decision.get('risk_alerts', []))} alerts
Bank options: {len(decision.get('bank_options', []))} options
""".strip()

    doc_id = f"{contract_id}_{int(time.time())}"
    metadata = {
        "contract_id": contract_id,
        "recommendation": rec,
        "confidence": str(confidence),
        "timestamp": str(int(time.time())),
    }

    try:
        col.add(documents=[doc_text], ids=[doc_id], metadatas=[metadata])
        return True
    except Exception as e:
        print(f"[RAG] store_analysis error: {e}")
        return False


def query_similar(contract_id: str, context_text: str, n_results: int = 3) -> list[dict]:
    """
    Truy vấn các phân tích tương tự từ memory.
    Trả về list các kết quả để inject vào prompt của agent.
    """
    col = _get_collection()
    if col is None or col.count() == 0:
        return []

    try:
        results = col.query(
            query_texts=[context_text],
            n_results=min(n_results, col.count()),
            where={"contract_id": {"$ne": contract_id}},  # không lấy chính nó
        )
        items = []
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            items.append({
                "contract_id": meta.get("contract_id"),
                "recommendation": meta.get("recommendation"),
                "confidence": meta.get("confidence"),
                "summary": doc[:300],
            })
        return items
    except Exception as e:
        print(f"[RAG] query_similar error: {e}")
        return []


def store_rule_knowledge(rules: list[dict], source: str = "OPC_RulesRAG"):
    """
    Nạp các rule từ Google Sheets vào RAG khi khởi động.
    """
    col = _get_collection()
    if col is None:
        return

    existing_ids = set(col.get()["ids"]) if col.count() > 0 else set()

    docs, ids, metas = [], [], []
    for i, rule in enumerate(rules):
        rule_id = rule.get("rule_id") or rule.get("id") or f"rule_{i}"
        doc_id = f"rule_{source}_{rule_id}"
        if doc_id in existing_ids:
            continue
        text = " | ".join(f"{k}: {v}" for k, v in rule.items() if v)
        docs.append(text)
        ids.append(doc_id)
        metas.append({"source": source, "rule_id": rule_id})

    if docs:
        try:
            col.add(documents=docs, ids=ids, metadatas=metas)
            print(f"[RAG] Stored {len(docs)} rules from {source}")
        except Exception as e:
            print(f"[RAG] store_rule_knowledge error: {e}")


def get_memory_stats() -> dict:
    col = _get_collection()
    if col is None:
        return {"enabled": False, "count": 0}
    return {"enabled": True, "count": col.count()}
