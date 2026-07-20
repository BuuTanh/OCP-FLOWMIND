"""Tra cứu thông tin phi tài chính phục vụ thẩm định hợp đồng."""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import re
import unicodedata
from urllib.parse import quote_plus
import xml.etree.ElementTree as ET

import requests


TU_KHOA_TICH_CUC = ("tăng trưởng", "mở rộng", "hợp tác", "phục hồi", "kỷ lục", "tích cực", "đầu tư", "cơ hội")
TU_KHOA_TIEU_CUC = ("khởi tố", "xử phạt", "vi phạm", "nợ", "phá sản", "suy giảm", "khủng hoảng", "đình chỉ", "thu hồi", "gian lận", "điều tra", "rủi ro")


def _chuan_hoa(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in text if unicodedata.category(c) != "Mn"))


def _tra_cuu_google_news(query: str, limit: int = 8) -> tuple[list[dict], str | None]:
    url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=vi&gl=VN&ceid=VN:vi"
    try:
        response = requests.get(url, timeout=12, headers={"User-Agent": "OPC-FlowMind/1.0"})
        response.raise_for_status()
        root = ET.fromstring(response.content)
        items = []
        for item in root.findall(".//item")[:limit]:
            source = item.find("source")
            raw_date = item.findtext("pubDate", "")
            try:
                published = parsedate_to_datetime(raw_date).date().isoformat()
            except Exception:
                published = raw_date
            title = item.findtext("title", "").strip()
            items.append({
                "title": title,
                "publisher": (source.text or "Không xác định").strip() if source is not None else "Không xác định",
                "published_at": published,
                "url": item.findtext("link", "").strip(),
                "snippet": re.sub(r"<[^>]+>", "", item.findtext("description", "")).strip()[:500],
                "tone": _sac_thai(title),
            })
        return items, None
    except Exception as exc:
        return [], f"Không thể kết nối nguồn tin công khai: {type(exc).__name__}"


def _sac_thai(text: str) -> str:
    value = text.lower()
    positive = sum(k in value for k in TU_KHOA_TICH_CUC)
    negative = sum(k in value for k in TU_KHOA_TIEU_CUC)
    return "tích cực" if positive > negative else "tiêu cực" if negative > positive else "trung lập"


def _diem_nguon(sources: list[dict]) -> tuple[int, str]:
    positive = sum(s["tone"] == "tích cực" for s in sources)
    negative = sum(s["tone"] == "tiêu cực" for s in sources)
    score = max(-100, min(100, round((positive - negative) / max(len(sources), 1) * 100)))
    label = "TÍCH CỰC" if score >= 20 else "TIÊU CỰC" if score <= -20 else "TRUNG LẬP"
    return score, label


def _xac_minh_dinh_danh(company_name: str, province: str, sources: list[dict]) -> tuple[str, list[dict]]:
    company_tokens = [t for t in _chuan_hoa(company_name).split() if len(t) >= 3 and t not in {"cong", "ty", "tnhh", "co", "phan"}]
    province_tokens = [t for t in _chuan_hoa(province).split() if len(t) >= 3]
    matched = []
    for source in sources:
        haystack = _chuan_hoa(source["title"] + " " + source["snippet"])
        name_hits = sum(token in haystack for token in company_tokens)
        province_hit = not province_tokens or any(token in haystack for token in province_tokens)
        if name_hits >= max(2, len(company_tokens) - 1) and province_hit:
            matched.append(source)
    status = "ĐÃ XÁC MINH SƠ BỘ" if len(matched) >= 2 else "CHƯA ĐỦ BẰNG CHỨNG ĐỊNH DANH"
    return status, matched


def _bao_cao(scope: str, subject: str, sources: list[dict], summary: str, actions: list[str],
             error: str | None = None, identity_status: str | None = None) -> dict:
    score, sentiment = _diem_nguon(sources)
    if identity_status == "CHƯA ĐỦ BẰNG CHỨNG ĐỊNH DANH":
        score, sentiment = 0, "CHƯA ĐỦ DỮ LIỆU"
    rid = hashlib.sha256(f"{scope}:{subject}:{datetime.now().date()}".encode()).hexdigest()[:12].upper()
    return {
        "agent": "Chuyên viên nghiên cứu doanh nghiệp" if scope == "company" else "Chuyên viên phân tích thị trường",
        "scope": scope, "subject": subject, "sentiment": sentiment, "sentiment_score": score,
        "confidence": min(90, 30 + len(sources) * 8), "executive_summary": summary,
        "positive_signals": [s["title"] for s in sources if s["tone"] == "tích cực"][:3],
        "negative_signals": [s["title"] for s in sources if s["tone"] == "tiêu cực"][:3],
        "recommended_actions": actions, "sources": sources, "identity_status": identity_status,
        "source_status": "Đã tra cứu nguồn công khai" if not error else error,
        "generated_at": datetime.now(timezone.utc).isoformat(), "report_id": f"NC-{rid}", "is_demo": False,
        "disclaimer": "Thông tin công khai chỉ hỗ trợ thẩm định; quyết định cuối cùng thuộc cấp có thẩm quyền.",
    }


def run_research(company_name: str, industry: str, province: str = "") -> dict:
    company_sources, company_error = _tra_cuu_google_news(f'"{company_name}" {province}')
    identity_status, verified_sources = _xac_minh_dinh_danh(company_name, province, company_sources)
    market_sources, market_error = _tra_cuu_google_news(f'"{industry}" thị trường Việt Nam')
    company_report = _bao_cao(
        "company", company_name, verified_sources,
        ("Đã tìm thấy nguồn có dấu hiệu phù hợp với tên và địa bàn của đối tác. Cần đối chiếu mã số thuế trước khi sử dụng."
         if identity_status == "ĐÃ XÁC MINH SƠ BỘ" else
         "Chưa có đủ nguồn công khai để khẳng định các bài viết tìm thấy thuộc đúng pháp nhân trong hồ sơ."),
        ["Đối chiếu mã số thuế, địa chỉ và người đại diện pháp luật", "Kiểm tra tranh chấp, xử phạt và lịch sử thực hiện hợp đồng"],
        company_error, identity_status,
    )
    market_report = _bao_cao(
        "market", industry, market_sources,
        "Tổng hợp diễn biến ngành gần đây nhằm nhận diện rủi ro có thể xuất hiện trước khi phản ánh vào số liệu tài chính.",
        ["Rà soát điều khoản điều chỉnh giá và tiến độ", "Xem xét chia giai đoạn thực hiện và hạn mức cam kết"], market_error,
    )
    c, m = company_report["sentiment_score"], market_report["sentiment_score"]
    combined = round(c * 0.55 + m * 0.45)
    if company_report["sentiment"] == "CHƯA ĐỦ DỮ LIỆU":
        overall = "CHƯA ĐỦ DỮ LIỆU"
    else:
        overall = "TÍCH CỰC" if combined >= 20 else "TIÊU CỰC" if combined <= -20 else "TRUNG LẬP"
    return {
        "company_report": company_report, "market_report": market_report,
        "overall": {"sentiment": overall, "sentiment_score": combined,
                    "decision_support": "Cần thẩm định bổ sung" if overall != "TÍCH CỰC" else "Có thể tiếp tục thẩm định",
                    "human_review_required": True},
        "methodology": "Tra cứu Google News → xác minh định danh → phân loại sắc thái → tổng hợp có trọng số",
        "is_demo": False,
    }


def run_contract_research(contract_id: str) -> dict:
    from data import loader
    contract = next((x for x in loader.get_contracts() if x.get("contract_id") == contract_id), {})
    customer = next((x for x in loader.get_customers() if x.get("customer_id") == contract.get("customer_id")), {})
    if not customer:
        return {"overall": {"sentiment": "CHƯA ĐỦ DỮ LIỆU", "sentiment_score": 0,
                            "decision_support": "Không xác định được khách hàng của hợp đồng", "human_review_required": True},
                "company_report": None, "market_report": None, "is_demo": False}
    return run_research(customer.get("customer_name", ""), customer.get("industry", ""), customer.get("province", ""))
