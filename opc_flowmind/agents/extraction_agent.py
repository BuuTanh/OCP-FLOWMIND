"""
Contract Extraction Agent — đọc hợp đồng PDF thô, trích xuất dữ liệu có cấu trúc
để founder xem lại và xác nhận trước khi hệ thống ghi vào 04_CONTRACTS.

Nguyên tắc bắt buộc: CHỈ trích xuất những gì thực sự xuất hiện rõ ràng trong văn bản.
Không suy diễn/tính toán giá trị không có trong tài liệu — đặc biệt gross_margin, vì
đây là chỉ số lợi nhuận NỘI BỘ của OPC (không xuất hiện trong hợp đồng ký với khách
hàng), nên luôn phải do founder tự nhập, không được để AI tự bịa ra con số này.
Việc "diễn đạt lại chuyên nghiệp" (description, payment_terms) chỉ được viết lại văn
phong — KHÔNG được thêm thông tin mới không có trong văn bản gốc.
"""
import io
import json
import re
from typing import Optional
from pypdf import PdfReader
from openai_engine.client import call_openai

EXTRACTION_SYSTEM = """
Bạn là trợ lý trích xuất dữ liệu hợp đồng cho OPC Digital Operations.
Nhiệm vụ: đọc văn bản hợp đồng thô, trích xuất CHÍNH XÁC các trường sau NẾU chúng xuất
hiện rõ ràng trong văn bản. TUYỆT ĐỐI KHÔNG suy diễn, tính toán hay bịa ra giá trị không
có trong văn bản — nếu không tìm thấy, để giá trị là null và liệt kê vào missing_fields.

CÁC TRƯỜNG CẦN TRÍCH XUẤT:
- customer_name: tên đối tác/khách hàng ký hợp đồng (chuỗi, giữ nguyên như trong văn bản)
- contract_value: giá trị hợp đồng bằng VND (số nguyên, không ký hiệu tiền tệ/dấu phẩy)
- start_date: ngày bắt đầu hiệu lực, định dạng YYYY-MM-DD nếu xác định được
- end_date: ngày kết thúc hiệu lực, định dạng YYYY-MM-DD nếu xác định được
- description: mô tả phạm vi công việc/dịch vụ, viết lại 1 câu NGẮN GỌN, chuyên nghiệp,
  đúng văn phong báo cáo kinh doanh — KHÔNG copy nguyên văn câu dài lê thê trong hợp đồng,
  nhưng KHÔNG được thêm chi tiết nào không có trong văn bản gốc, chỉ diễn đạt lại cho rõ ràng.
- payment_terms: điều khoản thanh toán, trình bày dưới dạng CÁC GẠCH ĐẦU DÒNG riêng biệt,
  mỗi đợt/điều kiện thanh toán 1 dòng bắt đầu bằng "• ", nối nhau bằng ký tự xuống dòng \\n.
  Diễn đạt lại ngắn gọn, chuyên nghiệp — không đổi ý nghĩa, không thêm thông tin mới.
  Ví dụ: "• Đợt 1: tạm ứng 30% giá trị hợp đồng sau khi ký\\n• Đợt 2: thanh toán 70% còn lại sau nghiệm thu"
- estimated_cost: TỔNG chi phí thực hiện dự kiến bằng VND, CHỈ khi văn bản có ghi rõ
  ràng con số này (ví dụ mục "chi phí thực hiện dự kiến", "tổng chi phí", bảng chi phí
  nội bộ...). Đây KHÔNG phải trường bắt buộc phải có trong mọi hợp đồng — phần lớn hợp
  đồng thật sẽ KHÔNG có mục này, lúc đó để null, không suy đoán.

KHÔNG BAO GIỜ trích xuất hoặc suy đoán gross_margin, customer_id, contract_id —
đây là dữ liệu quản trị nội bộ của OPC, không nằm trong nội dung hợp đồng.
gross_margin CHỈ được tính (bởi code, không phải bạn) khi cả contract_value và
estimated_cost đều thực sự có trong văn bản — nếu thiếu estimated_cost thì KHÔNG suy
đoán, không tự điền.

Trả về CHỈ MỘT JSON object, không giải thích gì thêm, đúng đúng format sau:
{
  "customer_name": "..." hoặc null,
  "contract_value": 123456789 hoặc null,
  "estimated_cost": 123456789 hoặc null,
  "start_date": "YYYY-MM-DD" hoặc null,
  "end_date": "YYYY-MM-DD" hoặc null,
  "description": "..." hoặc null,
  "payment_terms": "..." hoặc null,
  "missing_fields": ["tên các trường không tìm thấy rõ ràng trong văn bản"]
}
"""

_EMPTY_RESULT = {
    "customer_name": None, "contract_value": None, "estimated_cost": None,
    "start_date": None, "end_date": None, "description": None, "payment_terms": None,
    "missing_fields": [],
}


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def match_customer_id(customer_name: Optional[str], existing_customers: list[dict]) -> Optional[str]:
    """
    Đối chiếu tên khách hàng vừa trích xuất với danh sách khách hàng đã có trong hệ
    thống, để tránh tạo trùng mã cho cùng 1 công ty chỉ vì cách viết khác nhau (hoa/
    thường, dấu câu, khoảng trắng, viết tắt loại hình doanh nghiệp TNHH/Ltd/Co...).
    Dùng OpenAI thay vì so khớp chuỗi cứng vì OpenAI xử lý được các biến thể này tốt
    hơn nhiều — so khớp chuỗi đơn thuần dễ bỏ sót và tạo nhầm khách hàng trùng lặp.
    Trả về customer_id nếu CHẮC CHẮN trùng, ngược lại trả về None (khách hàng mới).
    """
    if not customer_name or not existing_customers:
        return None

    listing = "\n".join(f"{c['customer_id']}: {c['customer_name']}" for c in existing_customers)
    system = (
        "Bạn là trợ lý đối chiếu tên khách hàng trùng lặp.\n"
        "Nhiệm vụ: so sánh 1 tên khách hàng mới với danh sách khách hàng đã có, xác định "
        "xem có phải CÙNG MỘT công ty hay không — chấp nhận khác biệt về viết hoa/thường, "
        "dấu câu, khoảng trắng, dấu tiếng Việt, viết tắt loại hình doanh nghiệp (TNHH, Co., "
        "Ltd, HTX...). CHỈ xác nhận trùng khi bạn THỰC SỰ CHẮC CHẮN đây là cùng 1 công ty.\n"
        "Trả lời CHỈ đúng 1 dòng: mã khách hàng (VD: CUS-005) nếu chắc chắn trùng, "
        "hoặc đúng chữ NONE nếu là công ty khác/không chắc chắn. Không giải thích gì thêm."
    )
    user = f"DANH SÁCH KHÁCH HÀNG ĐÃ CÓ:\n{listing}\n\nTÊN KHÁCH HÀNG MỚI CẦN ĐỐI CHIẾU:\n{customer_name}"

    try:
        result_text, _call_id = call_openai(system, user, "Customer Matching Agent")
        m = re.search(r'CUS-\d+', result_text)
        if not m:
            return None
        candidate = m.group()
        valid_ids = {c["customer_id"] for c in existing_customers}
        return candidate if candidate in valid_ids else None
    except Exception:
        return None


def extract_contract_fields(pdf_bytes: bytes, existing_customers: Optional[list[dict]] = None) -> dict:
    """
    Đọc PDF hợp đồng → trả dict các trường trích xuất được + missing_fields +
    raw_text_preview (để founder tự đối chiếu khi cần) + matched_customer_id (nếu đối
    chiếu được với khách hàng đã có). KHÔNG ghi gì vào Sheets ở bước này — chỉ trả về
    để founder xem lại và xác nhận/sửa trước khi lưu thật.
    """
    text = extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        result = dict(_EMPTY_RESULT)
        result["missing_fields"] = ["Không đọc được nội dung PDF — có thể là file scan/ảnh, cần OCR"]
        result["raw_text_preview"] = ""
        result["computed_gross_margin"] = None
        result["margin_formula"] = None
        result["matched_customer_id"] = None
        return result

    user_prompt = f"Trích xuất dữ liệu từ hợp đồng sau:\n\n{text[:6000]}"

    try:
        result_text, _call_id = call_openai(EXTRACTION_SYSTEM, user_prompt, "Contract Extraction Agent")
    except Exception as e:
        result = dict(_EMPTY_RESULT)
        result["missing_fields"] = [f"Lỗi gọi OpenAI: {e} — cần nhập thủ công toàn bộ"]
        result["raw_text_preview"] = text[:500]
        result["computed_gross_margin"] = None
        result["margin_formula"] = None
        result["matched_customer_id"] = None
        return result

    match = re.search(r'\{[\s\S]+\}', result_text)
    if not match:
        result = dict(_EMPTY_RESULT)
        result["missing_fields"] = ["AI không trả về đúng định dạng — cần nhập thủ công toàn bộ"]
        result["raw_text_preview"] = text[:500]
        result["computed_gross_margin"] = None
        result["margin_formula"] = None
        result["matched_customer_id"] = None
        return result

    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        parsed = dict(_EMPTY_RESULT)
        parsed["missing_fields"] = ["Lỗi phân tích JSON từ AI — cần nhập thủ công toàn bộ"]

    for key, default in _EMPTY_RESULT.items():
        parsed.setdefault(key, default)
    parsed["raw_text_preview"] = text[:500]

    # gross_margin do CODE tính (không phải AI) — chỉ khi cả 2 số liệu gốc đều thực sự
    # có trong văn bản. Nếu thiếu estimated_cost, để null và giữ nguyên trong missing_fields
    # (không suy đoán, không lấy giá trị mặc định thay). margin_formula giải thích rõ
    # cách tính ra để founder tự kiểm chứng, không phải "hộp đen".
    value = parsed.get("contract_value")
    cost = parsed.get("estimated_cost")
    if isinstance(value, (int, float)) and isinstance(cost, (int, float)) and value > 0:
        margin = round((value - cost) / value, 4)
        parsed["computed_gross_margin"] = margin
        parsed["margin_formula"] = (
            f"(Giá trị hợp đồng − Chi phí thực hiện) / Giá trị hợp đồng "
            f"= ({value:,.0f} − {cost:,.0f}) / {value:,.0f} = {margin:.0%}"
        )
    else:
        parsed["computed_gross_margin"] = None
        parsed["margin_formula"] = None
        if "gross_margin" not in parsed["missing_fields"]:
            parsed["missing_fields"].append(
                "gross_margin (không có estimated_cost trong văn bản để tự tính — cần founder nhập tay)"
            )

    parsed["matched_customer_id"] = match_customer_id(parsed.get("customer_name"), existing_customers or [])

    return parsed
