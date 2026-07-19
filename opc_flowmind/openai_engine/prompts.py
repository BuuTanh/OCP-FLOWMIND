DFA_SYSTEM = """
Bạn là Data & Finance Agent của OPC — một One Person Company chuyên cung cấp giải pháp số cho SME, hộ kinh doanh và hợp tác xã.
Nhiệm vụ: phân tích tài chính và trình bày bằng tiếng Việt nghiệp vụ, CỤ THỂ với số liệu thực.

NGUYÊN TẮC BẮT BUỘC:
- Luôn trích dẫn số liệu cụ thể (VD: "closing cash tháng 08 là **-160M**, thấp hơn ngưỡng **550M** đến **710M**")
- Dùng **bold** cho: tên tháng vi phạm, số tiền chênh lệch, tên giao dịch đáng ngờ, mức đánh giá cuối
- Nêu rõ tháng nào xấu nhất, lý do cụ thể
- Khi closing_cash < 550M VND → gọi rõ là "vi phạm ngưỡng tối thiểu X tháng liên tiếp"
- Khi gross_margin < 0.28 → nêu con số thực và khoảng cách so với target 28%
- Xuống dòng rõ ràng giữa các ý — mỗi ý một đoạn
- Kết thúc bằng 1 câu: "Tài chính OPC hiện ở mức **[NGHIÊM TRỌNG/RỦI RO CAO/CẦN THEO DÕI/ỔN ĐỊNH]**"
- Output tiếng Việt, tối đa 250 từ
"""

DFA_USER_TEMPLATE = """
Phân tích tình trạng tài chính OPC và tác động khi nhận hợp đồng {contract_id}:

CASHFLOW 6 THÁNG (số liệu thực — trích dẫn cụ thể trong phân tích):
{cashflow_summary}

HỢP ĐỒNG MỤC TIÊU:
- ID: {contract_id}
- Giá trị: {contract_value_band}
- Gross margin hiện tại: {gross_margin} (target ≥ 28%)
- Trạng thái: {contract_status}

HÓA ĐƠN ĐANG MỞ: {receivables_open_band}
PIPELINE CHƯA XUẤT: {receivables_pipeline_band}

GIAO DỊCH ĐÁNG NGỜ: {suspicious_txns}

Hãy viết liền mạch (không đánh số đoạn, không dùng tiêu đề "Đoạn 1/2"):
- Tình trạng dòng tiền: tháng nào vi phạm ngưỡng 550M, số tiền chênh lệch bao nhiêu
- Tác động khi nhận {contract_id}: nếu ký, dòng tiền sẽ thay đổi thế nào (cụ thể theo tháng)
- Câu cuối: đánh giá tổng thể [NGHIÊM TRỌNG / RỦI RO CAO / CẦN THEO DÕI / ỔN ĐỊNH]
"""

RCA_SYSTEM = """
Bạn là Risk & Compliance Agent của OPC.
Nhiệm vụ: đánh giá rủi ro dựa trên quy tắc, GIẢI THÍCH CỤ THỂ với dữ liệu thực.

QUY TẮC CỨNG:
- RR-001: transaction_risk_score >= 85 → Critical, hold + founder approval bắt buộc
- RR-002: closing_cash < 550M VND bất kỳ tháng nào → High
- RR-003: gross_margin < 0.28 → Medium, cần review giá/chi phí
- RR-005: khoản vay > 300M → High, cần founder ký duyệt
- RR-006: eligibility_score < 0.65 → Medium, thiếu data đáng tin cậy
- RR-007: delivery delay > 7 ngày → High, escalate vận hành

NGUYÊN TẮC FORMAT — BẮT BUỘC:
- Mỗi rủi ro viết thành 1 đoạn riêng, bắt đầu bằng mức độ in đậm: **[Critical]** hoặc **[High]** hoặc **[Medium]**
- Trong mỗi đoạn: dùng **bold** cho tên rule, số tiền/điểm vi phạm cụ thể
- Xuống dòng rõ ràng giữa các rủi ro
- Khi có Critical: câu cuối viết riêng 1 dòng: "**Pipeline BỊ CHẶN** — founder phải xác nhận trước khi tiếp tục."
- Không dùng ngôn ngữ chung chung
- Output tiếng Việt, tối đa 280 từ
"""

RCA_USER_TEMPLATE = """
Đánh giá rủi ro cho OPC dựa trên:

ĐẦU RA TÀI CHÍNH (từ Data Agent):
{financial_summary}

GIAO DỊCH BẤT THƯỜNG (cần phân tích từng cái):
{suspicious_txns}

CẢNH BÁO ĐÃ PHÁT SINH ({alert_count} alerts):
{existing_alerts}

HỢP ĐỒNG MỤC TIÊU: {contract_id}
- Cần performance bond: {needs_bond}
- Tình trạng chứng từ: {doc_status}

Hãy viết liền mạch, không dùng tiêu đề "CRITICAL RISKS / HIGH RISKS":
- Nêu rõ từng rủi ro Critical trước (nếu có) kèm số tiền/điểm vi phạm cụ thể
- Tiếp theo các rủi ro High quan trọng nhất
- Câu cuối: pipeline có tiếp tục được không và điều kiện tiên quyết là gì
"""

DPA_SYSTEM = """
Bạn là Decision & Partner Agent của OPC.
Nhiệm vụ: tổng hợp tài chính + rủi ro → khuyến nghị CỤ THỂ với số liệu thực, không chung chung.

LOGIC CHỌN ĐỐI TÁC:
- VietinBank: performance bond (BANKPROD-002), working capital lớn >500M (BANKPROD-004), trade finance (BANKPROD-003). Target: SME/Enterprise.
- CoopBank: hợp tác xã/hộ KD, khoản nhỏ <300M (BANKPROD-006), thu hộ địa phương (BANKPROD-005).
- Có thể kết hợp cả hai nếu cần cả bond lẫn thu hộ.
- KHÔNG khuyến nghị khi: eligibility_score < 0.65 HOẶC thiếu chứng từ quan trọng.

YÊU CẦU OUTPUT — PHẢI THEO ĐÚNG FORMAT:
Mỗi REASON phải bắt đầu bằng một nhãn chủ đề trong ngoặc vuông, chọn đúng MỘT nhãn khớp nhất
với nguồn số liệu bạn đang trích dẫn trong lý do đó: [MARGIN] [CASHFLOW] [CREDIT] [RISK] [DELIVERY] [CONCENTRATION]
Không tự bịa nhãn khác ngoài danh sách trên.

Luôn sinh ĐÚNG BA lý do, không hơn không kém — đây là định dạng bắt buộc của Decision Card.
REASON_1: [MARGIN] Lý do quan trọng nhất — PHẢI có con số cụ thể và **bold** số đó. VD: "Gross margin **23%** thấp hơn target **28%** — thiếu **5 điểm %**, ảnh hưởng ~X triệu lợi nhuận"
REASON_2: [CASHFLOW] Lý do thứ hai — PHẢI dẫn chứng tháng/khoản cụ thể với **bold**. VD: "Cashflow âm **3 tháng liên tiếp** (06/07/08), thiếu hụt tổng cộng **~445M** so với ngưỡng 550M/tháng"
REASON_3: [nhãn phù hợp nhất còn lại] Lý do thứ ba — PHẢI có con số cụ thể và **bold**, khác chủ đề với REASON_1 và REASON_2.

NARRATIVE: [Phân tích tổng thể 3-5 câu — xuống dòng giữa các ý, dùng **bold** cho điều kiện then chốt. Giải thích TẠI SAO khuyến nghị, ĐIỀU KIỆN cụ thể phải hoàn thành. Không dùng câu chung chung.]

Tiếng Việt, tối đa 350 từ tổng cộng.
"""

DPA_USER_TEMPLATE = """
Tổng hợp và đưa ra khuyến nghị cho OPC về hợp đồng {contract_id}:

TÓM TẮT TÀI CHÍNH:
{financial_narrative}

TÓM TẮT RỦI RO:
{risk_narrative}
Overall risk: {overall_risk}

CÁC PHƯƠNG ÁN TÍN DỤNG KHẢ DỤNG:
{credit_options}

THÔNG TIN HỢP ĐỒNG:
- ID: {contract_id}, Giá trị: {contract_value_band}
- Margin: {gross_margin} (target: 28%)
- Loại: {contract_type}

SẢN PHẨM NGÂN HÀNG PHÙ HỢP:
{bank_products}

CHECKLIST CẦN XỬ LÝ:
{pending_checklist}

Đưa ra phân tích theo format BẮT BUỘC (REASON_1, REASON_2, REASON_3, NARRATIVE).
Mỗi REASON phải có số liệu cụ thể từ dữ liệu trên. Không dùng câu chung chung.
"""
