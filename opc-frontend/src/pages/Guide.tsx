import { useState } from 'react';
import {
  BookOpen, Database, GitBranch, Target, ShieldAlert, Calculator,
  ChevronDown, AlertTriangle, Lock, Mail, HelpCircle, MousePointerClick,
} from 'lucide-react';

// ── Reusable pieces ──────────────────────────────────────────────────────────

function SectionCard({ id, icon: Icon, title, subtitle, children }: {
  id: string; icon: typeof BookOpen; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm scroll-mt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="p-2.5 rounded-xl bg-brand-50 text-brand-700 shrink-0"><Icon size={19} /></span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FormulaCard({ title, formula, example, defaultOpen = false }: {
  title: string; formula: React.ReactNode; example: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${open ? 'border-brand-300' : 'border-slate-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
          open ? 'bg-brand-50 border-l-4 border-l-brand-600' : 'bg-slate-50 hover:bg-slate-100 border-l-4 border-l-transparent'
        }`}
      >
        <Calculator size={16} className={`shrink-0 ${open ? 'text-brand-700' : 'text-slate-400'}`} />
        <span className={`text-sm font-semibold flex-1 ${open ? 'text-brand-900' : 'text-slate-800'}`}>{title}</span>
        {!open && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 font-medium">
            <MousePointerClick size={12} /> Bấm để xem
          </span>
        )}
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180 text-brand-700' : 'text-slate-400'}`} />
      </button>
      {open && (
        <div className="px-4 py-4 bg-white space-y-3 border-t border-brand-100">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Công thức</div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 font-mono text-xs text-slate-800 overflow-x-auto">
              {formula}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Ví dụ minh hoạ (số liệu thật từ hệ thống)</div>
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 text-xs text-green-900 space-y-1">
              {example}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RULES = [
  { id: 'RR-001', name: 'Giao dịch rủi ro cao', threshold: 'transaction_risk_score ≥ 85', severity: 'Critical', note: 'Tự động tạm giữ (Hold) giao dịch — khoá Vùng 3 cho tới khi Founder xác nhận qua "Crisis resolved".' },
  { id: 'RR-002', name: 'Dòng tiền dưới ngưỡng dự trữ', threshold: 'closing_cash tháng bất kỳ < 550.000.000 VND', severity: 'High', note: 'Cảnh báo riêng cho từng tháng vi phạm — 1 hợp đồng có thể có nhiều alert RR-002 cùng lúc.' },
  { id: 'RR-003', name: 'Biên lợi nhuận dưới mục tiêu', threshold: 'gross_margin < 28%', severity: 'Medium', note: 'Không tự động chặn ký — chỉ đưa vào cân nhắc của điểm tin cậy tổng thể.' },
  { id: 'RR-004', name: 'Chứng từ gửi ra ngoài', threshold: '(theo dữ liệu 14_ALERTS có sẵn)', severity: 'tuỳ alert', note: 'Không phải rule do RCA tự tính — chỉ xuất hiện khi có alert được gắn nhãn RR-004 sẵn trong dữ liệu nguồn.' },
  { id: 'RR-005', name: 'Khoản vay lớn cần phê duyệt', threshold: 'requested_amount > 300.000.000 VND', severity: 'High', note: 'Bắt buộc Founder ký duyệt thủ công trước khi nộp hồ sơ ngân hàng — không thể bỏ qua.' },
  { id: 'RR-006', name: 'Điểm tin cậy hồ sơ tín dụng thấp', threshold: 'eligibility_score < 65%', severity: 'Medium', note: 'Đúng theo mục 4.3 thiết kế — đo trên từng hồ sơ tín dụng liên quan hợp đồng.' },
  { id: 'RR-007', name: 'Trễ giao hàng', threshold: 'delivery delay > 7 ngày', severity: 'High', note: 'Giới hạn đã biết: dữ liệu 06_ORDERS hiện thiếu ngày giao thực tế nên rule này chưa đánh giá được — không phải lỗi hệ thống.' },
  { id: 'DOC-CHECK', name: 'Thiếu chứng từ hồ sơ tín dụng', threshold: 'precheck_note ghi "Missing" hoặc approval_status = "Review"', severity: 'Medium', note: 'KHÔNG nằm trong 7 quy tắc RR chính thức — là kiểm tra bổ trợ nội bộ, tách riêng khỏi RR-006 để tránh nhầm lẫn 2 ý nghĩa khác nhau.' },
];

const GLOSSARY: { term: string; desc: string }[] = [
  { term: 'KY', desc: 'Khuyến nghị ký hợp đồng không điều kiện — margin đạt mục tiêu, có phương án tài chính phù hợp, không còn rủi ro nghiêm trọng.' },
  { term: 'KY_CO_DIEU_KIEN', desc: 'Khuyến nghị ký nhưng kèm điều kiện cần xử lý trước (crisis chưa giải quyết, margin chưa đạt, hồ sơ tín dụng bị chặn...).' },
  { term: 'KHONG_KY', desc: 'Khuyến nghị từ chối — margin dưới 10% (lỗ), hoặc thiếu hụt vốn quá 50% giá trị hợp đồng mà không có phương án tài trợ.' },
  { term: 'CHUA_DU_DU_LIEU', desc: 'Chưa đủ căn cứ ra khuyến nghị — điểm tin cậy dưới 65% VÀ có hạng mục dữ liệu thực sự còn thiếu. Hệ thống yêu cầu bổ sung thay vì đoán.' },
  { term: 'Điểm tin cậy (confidence_score)', desc: 'Chỉ số 0–1 thể hiện mức độ chắc chắn của khuyến nghị — dưới 65% coi là chưa đủ tin cậy để founder ký ngay.' },
  { term: 'Điều kiện bảo vệ (guard_condition)', desc: 'Đúng 1 điều kiện quan trọng nhất phải hoàn tất trước khi khuyến nghị có hiệu lực — ưu tiên theo mức nghiêm trọng: khủng hoảng > margin > chứng từ > ký kết chính thức.' },
  { term: 'Crisis Layer', desc: 'Lớp giám sát độc lập quét toàn bộ giao dịch ngân hàng (không phân biệt hợp đồng) — tự động giữ giao dịch điểm rủi ro ≥85, chỉ Founder mới giải toả được.' },
  { term: 'trace_id', desc: 'Mã dùng chung cho toàn bộ 1 lượt phân tích (Crisis Layer + 3 agent) — cho phép truy vết mọi log và lượt gọi OpenAI của cùng 1 phiên.' },
  { term: 'concentration_pct', desc: 'Tỷ trọng giá trị 1 hợp đồng trên tổng giá trị toàn bộ danh mục hiện có — cảnh báo khi ≥40%.' },
  { term: 'AGENT_LOG', desc: 'Nhật ký mỗi lượt agent chạy: nguồn dữ liệu, trường đã che, có gọi OpenAI hay không, model dùng, mã băm prompt (không lưu prompt gốc).' },
];

export function Guide() {
  return (
    <div className="space-y-5">
        {/* Intro */}
        <div id="tong-quan" className="bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl p-7 shadow-sm text-white scroll-mt-6">
          <div className="flex items-center gap-2.5 mb-2">
            <BookOpen size={20} />
            <h1 className="text-lg font-bold">Hướng dẫn sử dụng &amp; Kiến thức hệ thống</h1>
          </div>
          <p className="text-sm text-blue-100 leading-relaxed max-w-3xl">
            OPC FlowMind là hệ thống Agentic AI hỗ trợ quyết định nhận hợp đồng — gồm 3 AI Agent chạy nối
            tiếp theo mô hình ra quyết định 3 pha (Tình báo → Thiết kế → Lựa chọn). Máy đảm nhiệm phần tính
            toán tất định và phân tích dữ liệu; Founder giữ toàn quyền quyết định cuối cùng. Trang này giải
            thích từng thành phần, công thức tính toán kèm ví dụ số thật, và các thuật ngữ dùng trong hệ thống.
          </p>
        </div>

        {/* 3 Agents */}
        <SectionCard id="agents" icon={GitBranch} title="3 AI Agent trong hệ thống" subtitle="Chạy nối tiếp — đầu ra agent trước là đầu vào duy nhất của agent sau">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="text-xs font-bold text-blue-700 mb-1">01 · DATA &amp; FINANCE AGENT</div>
              <div className="text-xs text-slate-500 mb-2">Pha Tình báo</div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                <li><b>Đầu vào:</b> hợp đồng, đơn hàng, hoá đơn, giao dịch ngân hàng, dòng tiền</li>
                <li><b>Xử lý:</b> tính margin, thiếu hụt tài trợ, tuổi nợ hoá đơn</li>
                <li><b>Đầu ra:</b> ảnh chụp tài chính cho Agent tiếp theo</li>
              </ul>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 hover:border-amber-200 hover:shadow-sm transition-all">
              <div className="text-xs font-bold text-amber-700 mb-1">02 · RISK &amp; COMPLIANCE AGENT</div>
              <div className="text-xs text-slate-500 mb-2">Pha Thiết kế (ràng buộc)</div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                <li><b>Đầu vào:</b> ảnh chụp tài chính + dữ liệu rủi ro/tín dụng</li>
                <li><b>Xử lý:</b> áp 7 quy tắc RR-001→007, xếp hạng rủi ro tổng thể</li>
                <li><b>Đầu ra:</b> hồ sơ rủi ro + điều kiện tiên quyết</li>
              </ul>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 hover:border-emerald-200 hover:shadow-sm transition-all">
              <div className="text-xs font-bold text-emerald-700 mb-1">03 · DECISION &amp; PARTNER AGENT</div>
              <div className="text-xs text-slate-500 mb-2">Pha Thiết kế → chuẩn bị Lựa chọn</div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                <li><b>Đầu vào:</b> hồ sơ rủi ro + hồ sơ tín dụng + sản phẩm ngân hàng</li>
                <li><b>Xử lý:</b> so sánh phương án, tính điểm tin cậy tổng thể</li>
                <li><b>Đầu ra:</b> Decision Card — khuyến nghị, 3 lý do, 1 điều kiện bảo vệ</li>
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* 7 rules table */}
        <SectionCard id="rules" icon={ShieldAlert} title="7 Quy tắc rủi ro (RR-001 → RR-007)" subtitle="Áp dụng bởi Risk & Compliance Agent, cộng thêm 1 kiểm tra bổ trợ (DOC-CHECK)">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="text-left px-3 py-2.5">Mã</th>
                  <th className="text-left px-3 py-2.5">Tên</th>
                  <th className="text-left px-3 py-2.5">Ngưỡng</th>
                  <th className="text-center px-3 py-2.5">Mức</th>
                  <th className="text-left px-3 py-2.5">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RULES.map(r => (
                  <tr key={r.id} className="align-top hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-semibold text-brand-700 whitespace-nowrap">{r.id}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">{r.threshold}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                        r.severity === 'Critical' ? 'bg-red-100 text-red-700'
                        : r.severity === 'High' ? 'bg-orange-100 text-orange-700'
                        : r.severity === 'Medium' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>{r.severity}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Formulas */}
        <SectionCard id="formulas" icon={Calculator} title="Công thức tính toán" subtitle="Bấm vào từng thẻ bên dưới để xem công thức và ví dụ số thật đã chạy trên hệ thống">
          <div className="space-y-3">
            <FormulaCard
              title="1. Điểm tin cậy hồ sơ tín dụng (từng CR)"
              formula={<>confidence = eligibility_score × (1 − 0.15 × số_hạng_mục_thiếu)</>}
              example={<>
                <div>Hồ sơ <b>CR-002</b>: eligibility_score gốc = 0.70, thiếu 1 hạng mục (chưa xác nhận đủ mức dự trữ)</div>
                <div>→ confidence = 0.70 × (1 − 0.15×1) = 0.70 × 0.85 = <b>0.595 ≈ 60%</b></div>
                <div>→ Dưới ngưỡng 65% (RR-006) → hồ sơ chưa đủ điều kiện dùng cho phương án tài chính.</div>
              </>}
              defaultOpen
            />
            <FormulaCard
              title="2. Điểm tin cậy tổng thể của khuyến nghị (Decision & Partner Agent)"
              formula={<>
                overall_confidence = giới_hạn[0.15, 0.95]( 0.40×CR_base + 0.35×risk_factor + 0.25×margin_factor )<br /><br />
                risk_factor: Low=1.00 · Medium=0.75 · High=0.45 · Critical=0.20<br />
                margin_factor = giới_hạn[0.20, 1.00]( gross_margin / 0.28 )
              </>}
              example={<>
                <div>CR_base = 0.60, tổng thể rủi ro = <b>Critical</b> (risk_factor=0.20), gross_margin = 24%</div>
                <div>margin_factor = 0.24 / 0.28 = 0.857</div>
                <div>→ overall_confidence = 0.40×0.60 + 0.35×0.20 + 0.25×0.857 = 0.24 + 0.07 + 0.214 = <b>0.524 ≈ 52%</b></div>
                <div>→ Dưới 65% → kiểm tra tiếp có hạng mục thiếu dữ liệu thật không, để quyết định giữa CHUA_DU_DU_LIEU và KY_CO_DIEU_KIEN.</div>
                <div className="text-green-700/70 italic mt-1">(Đây đúng là số liệu thật đã chạy cho hợp đồng CON-004 trong hệ thống.)</div>
              </>}
            />
            <FormulaCard
              title="3. Tỷ trọng danh mục (concentration_pct)"
              formula={<>concentration_pct = giá_trị_hợp_đồng / tổng_giá_trị_toàn_bộ_danh_mục × 100</>}
              example={<>
                <div>Hợp đồng CON-004 giá trị 4,2 tỷ; tổng giá trị 9 hợp đồng hiện có ≈ 16,1 tỷ</div>
                <div>→ concentration_pct = 4.200.000.000 / 16.100.000.000 × 100 ≈ <b>26,1%</b></div>
                <div>Ngưỡng cảnh báo: ≥ 40% (giả định G2 trong thiết kế)</div>
              </>}
            />
            <FormulaCard
              title="4. Cây quyết định khuyến nghị cuối cùng"
              formula={<>
                1. gross_margin &lt; 10% → KHONG_KY (lỗ, không có lý do kinh doanh để ký)<br />
                2. confidence &lt; 65% và có hạng mục thiếu thật → CHUA_DU_DU_LIEU<br />
                3. confidence &lt; 65% nhưng KHÔNG thiếu dữ liệu (do rủi ro cao) → KY_CO_DIEU_KIEN<br />
                4. thiếu hụt vốn &gt; 50% giá trị hợp đồng và không có phương án tài trợ → KHONG_KY<br />
                5. còn khủng hoảng / margin chưa đạt / hồ sơ bị chặn → KY_CO_DIEU_KIEN<br />
                6. margin đạt, có phương án tài chính, không khủng hoảng → KY
              </>}
              example={<>
                <div>CON-004: margin=24% (≥10%, qua bước 1) → confidence=52% &lt; 65%, có hạng mục thiếu thật (CR-001 thiếu bằng chứng aging công nợ)</div>
                <div>→ Dừng ở bước 2 → khuyến nghị <b>CHUA_DU_DU_LIEU</b></div>
              </>}
            />
          </div>
        </SectionCard>

        {/* Exception flows */}
        <SectionCard id="exceptions" icon={AlertTriangle} title="3 Luồng ngoại lệ" subtitle="Đảm bảo hệ thống có hành vi xác định trong mọi tình huống bất thường">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-red-100 bg-red-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 mb-2"><Lock size={13}/> KHỦNG HOẢNG</div>
              <p className="text-xs text-red-800">Giao dịch điểm rủi ro ≥85 → tự động tạm giữ, khoá Vùng 3. Chỉ Founder xác nhận "Crisis resolved" mới mở lại được — agent không có quyền tự giải toả.</p>
            </div>
            <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2"><HelpCircle size={13}/> THIẾU DỮ LIỆU</div>
              <p className="text-xs text-slate-700">Confidence &lt;65% do thiếu hạng mục thật → chuyển CHUA_DU_DU_LIEU, liệt kê rõ hạng mục cần bổ sung thay vì đoán số liệu.</p>
            </div>
            <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-2"><Mail size={13}/> LỖI API</div>
              <p className="text-xs text-amber-800">Gọi OpenAI/Google Sheets lỗi → tự thử lại có giãn cách; hết lượt thử vẫn lỗi → dùng dữ liệu đệm gần nhất kèm nhãn thời điểm thay vì báo lỗi trắng.</p>
            </div>
          </div>
        </SectionCard>

        {/* Glossary */}
        <SectionCard id="glossary" icon={Database} title="Bảng thuật ngữ" subtitle="Tra cứu nhanh các trạng thái và khái niệm dùng trong hệ thống">
          <div className="divide-y divide-slate-100">
            {GLOSSARY.map(g => (
              <div key={g.term} className="py-3 grid grid-cols-1 md:grid-cols-4 gap-1 md:gap-4">
                <div className="md:col-span-1 font-mono text-xs font-bold text-brand-700">{g.term}</div>
                <div className="md:col-span-3 text-xs text-slate-600 leading-relaxed">{g.desc}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Quick usage */}
        <SectionCard id="usage" icon={Target} title="Cách sử dụng nhanh" subtitle="Các thao tác cơ bản khi vận hành hệ thống">
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
            <li>Vào <b>Phân tích AI</b> → chọn hợp đồng có sẵn hoặc upload PDF hợp đồng mới → bấm Chạy phân tích.</li>
            <li>Xem đủ 3 vùng: Dữ liệu đầu vào → Luồng Agent → Bảng quyết định, kèm 3 lý do và 1 điều kiện bảo vệ.</li>
            <li>Nếu còn Crisis Layer active: xử lý giao dịch với ngân hàng trước, rồi mới bật "Crisis resolved".</li>
            <li>Founder xác nhận Ký / Từ chối / Yêu cầu bổ sung — quyết định luôn cần con người, hệ thống không tự ký thay.</li>
            <li>Xem lại lịch sử phân tích trong Dashboard hoặc sidebar của trang Phân tích AI.</li>
          </ol>
        </SectionCard>
    </div>
  );
}
