"""
Dữ liệu lịch sử quyết định của nhà quản trị OPC.
Được nạp vào RAG khi khởi động để DPA agent tham khảo tiền lệ thực tế.
Không chứa số liệu tuyệt đối — chỉ mô tả pattern để tránh hallucination.
"""

DECISION_HISTORY: list[dict] = [
    {
        "decision_id": "DH-001",
        "contract_type": "Cung cấp rau củ quả hữu cơ",
        "customer_segment": "Hợp tác xã nông nghiệp",
        "financial_profile": "Gross margin ~24%, cashflow dương ổn định 8/12 tháng, doanh thu tăng trưởng 15% YoY",
        "risk_profile": "Rủi ro TRUNG BÌNH — phụ thuộc mùa vụ, 1 lần giao trễ trong 12 tháng qua",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.82",
        "manager_notes": (
            "Chấp thuận dù margin thấp hơn target 28% vì cashflow ổn định và lịch sử giao hàng "
            "đúng hạn 11/12 tháng. Yêu cầu thêm bảo hiểm mùa vụ làm điều kiện ký kết. "
            "Đây là đối tác chiến lược vùng Lâm Đồng — ưu tiên duy trì quan hệ dài hạn."
        ),
        "outcome": "Hợp đồng thực hiện tốt, OPC gia hạn thêm 2 năm sau đó.",
    },
    {
        "decision_id": "DH-002",
        "contract_type": "Phân phối thực phẩm chế biến",
        "customer_segment": "Doanh nghiệp SME",
        "financial_profile": "Gross margin ~18%, cashflow âm 4 tháng liên tiếp, nợ quá hạn >30 ngày",
        "risk_profile": "Rủi ro CAO — eligibility_score thấp, thiếu báo cáo tài chính kiểm toán",
        "recommendation": "KHONG_KY",
        "confidence": "0.88",
        "manager_notes": (
            "Từ chối vì cashflow âm kéo dài và thiếu chứng từ kiểm toán. "
            "Margin 18% không đủ bù chi phí vận hành và rủi ro tín dụng. "
            "Đề nghị đối tác quay lại sau khi có báo cáo tài chính 2 năm liên tiếp được kiểm toán."
        ),
        "outcome": "Quyết định đúng — đối tác này sau đó vỡ nợ với nhà cung cấp khác.",
    },
    {
        "decision_id": "DH-003",
        "contract_type": "Cung cấp nguyên liệu nông sản thô",
        "customer_segment": "Hộ kinh doanh cá thể",
        "financial_profile": "Gross margin ~31%, cashflow dương ổn định, giá trị hợp đồng nhỏ <200M",
        "risk_profile": "Rủi ro THẤP — lịch sử thanh toán tốt, hồ sơ đầy đủ",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.91",
        "manager_notes": (
            "Chấp thuận nhanh — margin tốt, rủi ro thấp, hồ sơ hoàn chỉnh. "
            "Giá trị nhỏ nên không cần performance bond. CoopBank phù hợp cho đối tượng hộ KD. "
            "Lưu ý: tổng tỷ trọng danh mục từ hộ KD đang tăng, cần theo dõi mức tập trung."
        ),
        "outcome": "Thực hiện suôn sẻ, thanh toán đúng hạn 100%.",
    },
    {
        "decision_id": "DH-004",
        "contract_type": "Xuất khẩu nông sản chế biến",
        "customer_segment": "Doanh nghiệp xuất khẩu",
        "financial_profile": "Gross margin ~29%, cashflow biến động theo quý, giá trị lớn >2 tỷ",
        "risk_profile": "Rủi ro TRUNG BÌNH-CAO — rủi ro tỷ giá, thị trường xuất khẩu biến động",
        "recommendation": "XEM_XET_LAI",
        "confidence": "0.71",
        "manager_notes": (
            "Hoãn quyết định — yêu cầu bổ sung hợp đồng ngoại tệ forward để phòng ngừa rủi ro tỷ giá. "
            "Margin đạt target nhưng biến động cashflow theo quý tạo áp lực thanh khoản ngắn hạn. "
            "Cần VietinBank trade finance để hỗ trợ L/C xuất khẩu trước khi chấp thuận."
        ),
        "outcome": "Sau khi bổ sung hợp đồng forward, được chấp thuận và thực hiện thành công.",
    },
    {
        "decision_id": "DH-005",
        "contract_type": "Cung cấp thực phẩm hữu cơ cho chuỗi bán lẻ",
        "customer_segment": "Doanh nghiệp bán lẻ vừa",
        "financial_profile": "Gross margin ~26%, cashflow dương nhưng co hẹp dần trong 3 tháng gần nhất",
        "risk_profile": "Rủi ro TRUNG BÌNH — tập trung danh mục cao (1 khách hàng chiếm >40% doanh thu)",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.76",
        "manager_notes": (
            "Chấp thuận có điều kiện — yêu cầu bổ sung điều khoản phạt trễ thanh toán >15 ngày. "
            "Rủi ro tập trung được chấp nhận vì khách hàng là chuỗi bán lẻ có thương hiệu. "
            "Yêu cầu performance bond qua VietinBank để bảo vệ OPC nếu chuỗi đóng cửa đột ngột."
        ),
        "outcome": "Thực hiện tốt năm đầu, năm thứ hai chuỗi thu hẹp quy mô nhưng vẫn thanh toán đủ.",
    },
    {
        "decision_id": "DH-006",
        "contract_type": "Thu mua nông sản theo mùa vụ",
        "customer_segment": "Hợp tác xã nông nghiệp",
        "financial_profile": "Gross margin ~22%, cashflow âm 2 tháng cuối vụ, tồn kho cao",
        "risk_profile": "Rủi ro TRUNG BÌNH — mùa vụ rủi ro thời tiết, hồ sơ thiếu báo lãi lỗ gần nhất",
        "recommendation": "CHUA_DU_DU_LIEU",
        "confidence": "0.63",
        "manager_notes": (
            "Tạm hoãn vì thiếu báo cáo lãi lỗ 6 tháng gần nhất và kế hoạch xử lý tồn kho. "
            "Không thể đánh giá đủ khả năng thanh toán khi cashflow âm cuối vụ mà không có dữ liệu kho. "
            "Yêu cầu nộp bổ sung trong 10 ngày làm việc."
        ),
        "outcome": "HTX nộp bổ sung sau 8 ngày, được chấp thuận và thực hiện đúng hạn.",
    },
    {
        "decision_id": "DH-007",
        "contract_type": "Gia công chế biến thực phẩm",
        "customer_segment": "Doanh nghiệp sản xuất vừa",
        "financial_profile": "Gross margin ~33%, cashflow mạnh, hệ số thanh toán nhanh >1.5",
        "risk_profile": "Rủi ro THẤP — hồ sơ kiểm toán đầy đủ, lịch sử hợp tác 3 năm với OPC",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.95",
        "manager_notes": (
            "Chấp thuận nhanh — đây là đối tác lâu năm với track record xuất sắc. "
            "Margin vượt target, cashflow mạnh, không cần thêm điều kiện. "
            "Cân nhắc ưu đãi lãi suất qua VietinBank working capital để giữ chân đối tác."
        ),
        "outcome": "Hợp đồng ký kết và mở rộng quy mô thêm 30% trong năm tiếp theo.",
    },
    {
        "decision_id": "DH-008",
        "contract_type": "Cung cấp dịch vụ logistics nông sản",
        "customer_segment": "Công ty logistics",
        "financial_profile": "Gross margin ~20%, cashflow ổn định, chi phí nhiên liệu biến động cao",
        "risk_profile": "Rủi ro TRUNG BÌNH — chi phí đầu vào biến động, phụ thuộc giá xăng dầu",
        "recommendation": "XEM_XET_LAI",
        "confidence": "0.69",
        "manager_notes": (
            "Hoãn — yêu cầu thêm điều khoản điều chỉnh giá theo biến động nhiên liệu >15%. "
            "Margin 20% quá mỏng để hấp thụ biến động chi phí logistics. "
            "Không từ chối hoàn toàn vì năng lực vận tải của đối tác phù hợp nhu cầu mùa cao điểm."
        ),
        "outcome": "Sau khi bổ sung điều khoản điều chỉnh giá, được chấp thuận.",
    },
    {
        "decision_id": "DH-009",
        "contract_type": "Nhập khẩu nguyên liệu thực phẩm",
        "customer_segment": "Nhà nhập khẩu",
        "financial_profile": "Gross margin ~27%, cashflow dương, giá trị lớn >3 tỷ, thanh toán L/C",
        "risk_profile": "Rủi ro TRUNG BÌNH — rủi ro quốc gia, biến động tỷ giá, thời gian giao hàng dài",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.80",
        "manager_notes": (
            "Chấp thuận với điều kiện mở L/C qua VietinBank trade finance để kiểm soát thanh toán. "
            "Margin đạt gần target, rủi ro tỷ giá được phòng ngừa bằng hợp đồng forward đã ký sẵn. "
            "Đây là nguồn nguyên liệu chiến lược khó thay thế trong ngắn hạn."
        ),
        "outcome": "Thực hiện tốt, lô hàng đúng hạn, OPC tiết kiệm được 8% chi phí so với mua spot.",
    },
    {
        "decision_id": "DH-010",
        "contract_type": "Cung cấp bao bì thực phẩm",
        "customer_segment": "Nhà sản xuất bao bì SME",
        "financial_profile": "Gross margin ~16%, cashflow âm 5/12 tháng, nợ vay ngân hàng cao",
        "risk_profile": "Rủi ro CAO — đòn bẩy tài chính cao, lịch sử gia hạn nợ 2 lần",
        "recommendation": "KHONG_KY",
        "confidence": "0.85",
        "manager_notes": (
            "Từ chối — margin quá thấp và rủi ro tài chính của đối tác quá cao. "
            "Với nợ vay/vốn chủ sở hữu >3x và lịch sử gia hạn nợ, khả năng thực hiện hợp đồng "
            "không đảm bảo. OPC cần tìm nhà cung cấp bao bì thay thế trong vòng 60 ngày."
        ),
        "outcome": "Quyết định đúng — đối tác này ngừng hoạt động 4 tháng sau đó.",
    },
    {
        "decision_id": "DH-011",
        "contract_type": "Cung cấp rau sạch theo tiêu chuẩn VietGAP",
        "customer_segment": "Hợp tác xã rau sạch",
        "financial_profile": "Gross margin ~28%, cashflow ổn định, chứng nhận VietGAP còn hiệu lực",
        "risk_profile": "Rủi ro THẤP — đáp ứng đầy đủ tiêu chuẩn, hồ sơ hoàn chỉnh",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.89",
        "manager_notes": (
            "Chấp thuận — đúng target margin, rủi ro thấp, chứng nhận chất lượng đầy đủ. "
            "CoopBank phù hợp hỗ trợ HTX với gói tín dụng hợp tác xã ưu đãi. "
            "Lưu ý theo dõi gia hạn chứng nhận VietGAP — cần cập nhật trước 30 ngày hết hạn."
        ),
        "outcome": "Hợp đồng mẫu mực, được dùng làm benchmark cho các HTX khác.",
    },
    {
        "decision_id": "DH-012",
        "contract_type": "Phân phối thực phẩm đông lạnh",
        "customer_segment": "Siêu thị vừa",
        "financial_profile": "Gross margin ~25%, cashflow dương nhẹ, chi phí kho lạnh cao làm ăn mòn margin",
        "risk_profile": "Rủi ro TRUNG BÌNH — chi phí vận hành kho lạnh biến động, công nợ phải thu 60 ngày",
        "recommendation": "CHAP_THUAN",
        "confidence": "0.74",
        "manager_notes": (
            "Chấp thuận có điều kiện — rút ngắn công nợ phải thu xuống còn 45 ngày. "
            "Margin 25% chỉ đạt được nếu tối ưu lịch phân phối giảm chi phí kho lạnh trống. "
            "Yêu cầu đặt cọc 10% giá trị hợp đồng để đảm bảo cam kết của siêu thị."
        ),
        "outcome": "Thực hiện tốt sau khi điều chỉnh điều khoản công nợ.",
    },
]
