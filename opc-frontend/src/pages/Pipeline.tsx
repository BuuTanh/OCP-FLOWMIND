import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Play, CheckCircle, AlertTriangle, Loader, ChevronDown, ChevronUp,
         XCircle, Clock, FileCheck, Banknote, X, ArrowRight, User, Target, Database, History,
         PenLine, ThumbsDown, ClipboardList, RotateCcw, GitBranch, Shield, TrendingDown, TrendingUp,
         UploadCloud, ListChecks, Sparkles, UserCheck, UserPlus, Calculator,
         type LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { StatusBadge } from '../components/StatusBadge';
import type { AnalysisResult, CashflowMonth, ExtractedContract, Customer } from '../types';
import type { ContractDecision } from '../context/AppContext';

const CONTRACTS_FALLBACK: string[] = [];

const SEVERITY_BADGE: Record<string, string> = {
  'Critical':      'bg-red-100 text-red-700 border border-red-200',
  'High':          'bg-orange-100 text-orange-700 border border-orange-200',
  'Medium':        'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'NGHIÊM TRỌNG':  'bg-red-100 text-red-700 border border-red-200',
  'RỦI RO CAO':    'bg-orange-100 text-orange-700 border border-orange-200',
  'CẦN THEO DÕI':  'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'ỔN ĐỊNH':       'bg-green-100 text-green-700 border border-green-200',
};

// Render markdown-lite: **bold**, severity badges, bullet lists, line breaks
function renderMd(text: string | undefined | null, invert = false) {
  if (!text) return null;
  const baseText = invert ? 'text-current' : 'text-slate-700';
  const lines = text.split('\n').filter(l => l.trim());

  function parseBold(line: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let last = 0;
    const re = /\*\*(.+?)\*\*/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      // Severity badge nếu match
      const badgeCls = SEVERITY_BADGE[m[1]];
      if (badgeCls) {
        parts.push(
          <span key={m.index} className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
            {m[1]}
          </span>
        );
      } else {
        parts.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
  }

  const nodes: React.ReactNode[] = [];
  let bulletBuf: string[] = [];

  function flushBullets(key: number) {
    if (!bulletBuf.length) return;
    nodes.push(
      <ul key={`ul-${key}`} className="mt-3 space-y-1.5 pl-1">
        {bulletBuf.map((b, bi) => (
          <li key={bi} className={`flex gap-2.5 text-sm ${baseText}`}>
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span className="leading-relaxed">{parseBold(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuf = [];
  }

  lines.forEach((line, i) => {
    if (/^[-•]\s/.test(line)) {
      bulletBuf.push(line.replace(/^[-•]\s+/, ''));
    } else {
      flushBullets(i);
      // Dòng chỉ có badge severity (VD: "**Pipeline BỊ CHẶN**...") → highlight block
      const isBlockingLine = /pipeline.*bị chặn/i.test(line);
      nodes.push(
        <p key={i} className={`mt-3 first:mt-0 text-sm leading-relaxed ${baseText} ${isBlockingLine ? 'font-medium' : ''}`}>
          {parseBold(line)}
        </p>
      );
    }
  });
  flushBullets(lines.length);
  return nodes;
}

const REC_LABELS: Record<string, string> = {
  KY: '✅ KÝ HỢP ĐỒNG',
  KY_CO_DIEU_KIEN: '⚠️ KÝ CÓ ĐIỀU KIỆN',
  KHONG_KY: '❌ KHÔNG KÝ',
  CHUA_DU_DATA: '⏳ CHƯA ĐỦ DỮ LIỆU',
  CHUA_DU_DU_LIEU: '⏳ CHƯA ĐỦ DỮ LIỆU',
};

const REC_COLORS: Record<string, string> = {
  KY: 'bg-green-50 border-green-300 text-green-800',
  KY_CO_DIEU_KIEN: 'bg-amber-50 border-amber-300 text-amber-800',
  KHONG_KY: 'bg-red-50 border-red-300 text-red-800',
  CHUA_DU_DATA: 'bg-gray-50 border-gray-300 text-gray-600',
  CHUA_DU_DU_LIEU: 'bg-gray-50 border-gray-300 text-gray-600',
};

// ── Popup detail content generator ──────────────────────────────────────────
interface ResolutionDetail {
  title: string;
  type: 'txn' | 'credit' | 'order' | 'doc' | 'generic';
  responsible: string;
  steps: string[];
  expected_outcome: string;
  data_impact: string;
  urgency: 'Critical' | 'High' | 'Medium';
}

function parseChecklistItem(raw: string): { text: string; recordId: string; detail: ResolutionDetail } {
  const text = raw.replace(/^\[[ x]\] /, '').trim();

  // TXN suspicious
  const txnMatch = text.match(/TXN-(\d+)/);
  if (txnMatch) {
    const id = `TXN-${txnMatch[1]}`;
    return {
      text, recordId: id,
      detail: {
        title: `Xử lý giao dịch đáng ngờ ${id}`,
        type: 'txn',
        responsible: 'Founder / CEO',
        urgency: 'Critical',
        steps: [
          `1. Đăng nhập VietinBank Business Online → Tra soát giao dịch ${id}`,
          `2. Xác minh với bộ phận kế toán: giao dịch này có được phê duyệt không?`,
          `3. Nếu là giao dịch hợp lệ: ghi chú lý do vào file OPC_FinancialData (tab 08_BANK_TXN), cập nhật cột txn_status = "Normal"`,
          `4. Nếu là giao dịch trái phép: liên hệ ngân hàng khóa giao dịch, lập biên bản, thông báo pháp lý`,
          `5. Sau khi xử lý: toggle "Crisis resolved" ON trong hệ thống → pipeline sẽ bỏ qua alert này`,
        ],
        expected_outcome: `Sau khi tick "Đã xử lý" và chạy lại phân tích: ${id} sẽ không còn tạo Critical alert — pipeline có thể tiếp tục. Nếu cả TXN-006 và TXN-007 đều xử lý, recommendation có thể chuyển từ KÝ CÓ ĐIỀU KIỆN → KÝ.`,
        data_impact: `Cập nhật tab 08_BANK_TXN trong OPC_FinancialData: cột txn_status của ${id} từ "Suspicious" → "Normal". Sau đó nhấn "Reload cache" trong Cài đặt để hệ thống đọc lại dữ liệu mới.`,
      }
    };
  }

  // Credit case large amount
  const crLargeMatch = text.match(/(CR-\d+)\s*\((\d+)M/);
  if (crLargeMatch && text.includes('ký duyệt')) {
    const id = crLargeMatch[1];
    const amount = crLargeMatch[2];
    return {
      text, recordId: `approve:${id}`,
      detail: {
        title: `Founder ký duyệt hồ sơ tín dụng ${id}`,
        type: 'credit',
        responsible: 'Founder / CEO',
        urgency: 'High',
        steps: [
          `1. Xem lại hồ sơ ${id}: loại sản phẩm, số tiền ${amount}M VND, điều khoản lãi suất`,
          `2. Kiểm tra tính khả thi: dòng tiền sau khi vay có đủ trả lãi hàng tháng không?`,
          `3. Ký vào tờ trình phê duyệt tín dụng nội bộ (lưu vào thư mục Drive dự án)`,
          `4. Chuyển cho kế toán chuẩn bị hồ sơ nộp ngân hàng`,
          `5. Tick "Đã xử lý" ở đây để hệ thống biết điều kiện này đã hoàn thành`,
        ],
        expected_outcome: `${id} sẽ không còn tạo High alert "vượt 300M threshold". Nếu đây là điều kiện cuối cùng, recommendation có thể chuyển sang KÝ.`,
        data_impact: `Cập nhật tab 10_CREDIT_PROFILE trong OPC_FinancialData: cột approval_status của ${id} từ "Review" → "Approved". Đồng thời ghi chú ngày ký vào cột precheck_note.`,
      }
    };
  }

  // Credit case missing docs
  const crDocMatch = text.match(/(CR-\d+)/);
  if (crDocMatch && (text.includes('Bổ sung') || text.includes('chứng từ') || text.includes('Missing'))) {
    const id = crDocMatch[1];
    return {
      text, recordId: id,
      detail: {
        title: `Bổ sung chứng từ hồ sơ ${id}`,
        type: 'doc',
        responsible: 'Kế toán / Thủ quỹ',
        urgency: 'Medium',
        steps: [
          `1. Xem nội dung thiếu trong hồ sơ ${id} (cột precheck_note trong Google Sheets)`,
          `2. Liên hệ nhà cung cấp/đối tác yêu cầu cung cấp chứng từ còn thiếu`,
          `3. Scan và upload chứng từ vào Google Drive thư mục "Hồ sơ tín dụng/${id}"`,
          `4. Cập nhật cột precheck_note trong OPC_FinancialData: xóa chữ "Missing", ghi "Complete - [ngày]"`,
          `5. Tick "Đã xử lý" tại đây để hệ thống tính lại eligibility score`,
        ],
        expected_outcome: `Sau khi chứng từ đầy đủ, ${id} đủ điều kiện được tính vào phương án tài chính → confidence score tăng → khả năng cao hơn để đủ điều kiện vay.`,
        data_impact: `Tab 10_CREDIT_PROFILE trong OPC_FinancialData: cập nhật precheck_note của ${id} bỏ từ "Missing". Hệ thống sẽ tự tính lại eligibility sau khi reload cache.`,
      }
    };
  }

  // Order at risk
  const ordMatch = text.match(/(ORD-\d+)/);
  if (ordMatch) {
    const id = ordMatch[1];
    return {
      text, recordId: id,
      detail: {
        title: `Xử lý rủi ro vận hành ${id}`,
        type: 'order',
        responsible: 'Quản lý vận hành / PM',
        urgency: 'High',
        steps: [
          `1. Họp khẩn với PM phụ trách ${id}: xác định nguyên nhân "At risk" (thiếu nhân lực, vật tư, tiến độ?)`,
          `2. Lập kế hoạch hành động cụ thể: gia hạn có đồng ý của khách hàng, hoặc thuê ngoài, hoặc tái phân bổ nguồn lực`,
          `3. Cập nhật cột delivery_note trong OPC_CoreData (tab 06_ORDERS) với kế hoạch xử lý`,
          `4. Nếu đã có giải pháp: cập nhật status = "On track" trong Google Sheets`,
          `5. Tick "Đã xử lý" tại đây để loại bỏ alert này khỏi lần phân tích tiếp theo`,
        ],
        expected_outcome: `${id} sẽ không còn tạo High alert "delivery delay". Tổng số High alerts giảm → overall risk level có thể hạ từ Critical/High xuống Medium.`,
        data_impact: `Tab 06_ORDERS trong OPC_CoreData: cập nhật cột status của ${id} từ "At risk" → "On track" và ghi chú kế hoạch xử lý vào cột delivery_note.`,
      }
    };
  }

  // Generic fallback
  return {
    text, recordId: text.slice(0, 20),
    detail: {
      title: text,
      type: 'generic',
      responsible: 'Founder / Quản lý',
      urgency: 'Medium',
      steps: ['1. Xem xét nội dung yêu cầu', '2. Thực hiện hành động phù hợp', '3. Tick "Đã xử lý" sau khi hoàn thành'],
      expected_outcome: 'Alert tương ứng sẽ được loại khỏi lần phân tích tiếp theo.',
      data_impact: 'Cập nhật dữ liệu liên quan trong Google Sheets và reload cache trong Cài đặt.',
    }
  };
}

// ── Resolution Detail Modal ──────────────────────────────────────────────────
function ResolutionModal({ detail, onClose }: { detail: ResolutionDetail; onClose: () => void }) {
  const urgencyColor = detail.urgency === 'Critical' ? 'text-red-600 bg-red-50 border-red-200'
    : detail.urgency === 'High' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-blue-600 bg-blue-50 border-blue-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-3 rounded-t-2xl">
          <div className="flex-1">
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border mb-2 ${urgencyColor}`}>
              {detail.urgency === 'Critical' ? '🔴' : detail.urgency === 'High' ? '🟡' : '🔵'} {detail.urgency}
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">{detail.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Responsible */}
          <div className="flex items-center gap-2 text-sm">
            <User size={15} className="text-slate-400 shrink-0" />
            <span className="text-slate-500">Người thực hiện:</span>
            <span className="font-semibold text-slate-800">{detail.responsible}</span>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              <ArrowRight size={13} className="text-brand-600" />
              Các bước thực hiện
            </div>
            <div className="space-y-2">
              {detail.steps.map((step, i) => (
                <div key={i} className="flex gap-3 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5">
                  <span className="font-bold text-brand-700 shrink-0 w-4">{i + 1}.</span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expected outcome */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-green-700 mb-1.5">
              <Target size={13} />
              Kết quả sau khi xử lý
            </div>
            <p className="text-sm text-green-800 leading-relaxed">{detail.expected_outcome}</p>
          </div>

          {/* Data impact */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1.5">
              <Database size={13} />
              Cập nhật dữ liệu Google Sheets
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">{detail.data_impact}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Decision Modals ──────────────────────────────────────────────────────────

const REJECT_REASONS = [
  'Margin quá thấp, không đảm bảo lợi nhuận tối thiểu',
  'Rủi ro tín dụng / thanh khoản quá cao',
  'Hồ sơ pháp lý chưa đầy đủ, không thể ký',
  'Điều kiện hợp đồng không có lợi cho doanh nghiệp',
  'Đối tác không đáp ứng yêu cầu năng lực thực hiện',
  'Phát hiện gian lận / giao dịch đáng ngờ chưa giải quyết',
  'Lý do khác (ghi chú bên dưới)',
];

interface ConfirmSignModalProps {
  contractId: string;
  decision: AnalysisResult['zone_decision'];
  resolvedCount: number;
  totalChecklist: number;
  runId?: string;
  onConfirm: (d: ContractDecision) => void;
  onClose: () => void;
}
function ConfirmSignModal({ contractId, decision, resolvedCount, totalChecklist, runId, onConfirm, onClose }: ConfirmSignModalProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = typed.trim().toUpperCase() === 'XÁC NHẬN';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="bg-green-600 rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <PenLine size={18} /> Xác nhận ký hợp đồng {contractId}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-lg font-bold text-slate-800">{(decision.confidence_score * 100).toFixed(0)}%</div>
              <div className="text-xs text-slate-500 mt-0.5">Độ tin cậy</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-lg font-bold text-slate-800">{resolvedCount}/{totalChecklist}</div>
              <div className="text-xs text-slate-500 mt-0.5">Điều kiện đã hoàn thành</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-lg font-bold text-green-700">{decision.bank_options?.length ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">Phương án ngân hàng</div>
            </div>
          </div>

          {/* Reasons */}
          {decision.three_reasons && decision.three_reasons.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="text-xs font-semibold text-green-700 mb-2">Lý do AI đề xuất ký:</div>
              <ul className="space-y-1">
                {decision.three_reasons.map((r, i: number) => (
                  <li key={i} className="text-sm text-green-800 flex gap-2">
                    <span className="text-green-500 shrink-0">✓</span>
                    <span>
                      {r.text}
                      <span className="text-green-600/70 text-xs ml-1">
                        (Nguồn: {r.source_sheet}.{r.source_cell})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Checklist warning */}
          {resolvedCount < totalChecklist && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <span><strong>{totalChecklist - resolvedCount} mục checklist chưa xử lý.</strong> Bạn vẫn có thể ký nhưng chịu trách nhiệm về các điều kiện chưa hoàn thành.</span>
            </div>
          )}

          {/* Confirm input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Gõ <span className="font-mono bg-slate-100 px-1 rounded">XÁC NHẬN</span> để xác thực quyết định
            </label>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="XÁC NHẬN"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm({
              contractId, action: 'KY', timestamp: new Date().toISOString(),
              runId, confidence: decision.confidence_score, recommendation: decision.recommendation,
            })}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
          >
            ✅ Ký hợp đồng
          </button>
        </div>
      </div>
    </div>
  );
}

interface RejectModalProps {
  contractId: string;
  runId?: string;
  onConfirm: (d: ContractDecision) => void;
  onClose: () => void;
}
function RejectModal({ contractId, runId, onConfirm, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-red-600 rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <ThumbsDown size={18} /> Từ chối hợp đồng {contractId}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Lý do từ chối <span className="text-red-500">*</span></label>
            <div className="space-y-1.5">
              {REJECT_REASONS.map(r => (
                <label key={r} className="flex items-start gap-2.5 cursor-pointer group">
                  <input type="radio" name="reject_reason" value={r} checked={reason === r}
                    onChange={() => setReason(r)}
                    className="mt-0.5 accent-red-600" />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ghi chú thêm (tuỳ chọn)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Mô tả chi tiết lý do, điều kiện có thể xem xét lại..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button
            disabled={!reason}
            onClick={() => onConfirm({
              contractId, action: 'TU_CHOI', timestamp: new Date().toISOString(),
              runId, rejectReason: reason, rejectNote: note.trim() || undefined,
            })}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
          >
            ❌ Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

interface RequestModalProps {
  contractId: string;
  pendingItems: string[];
  runId?: string;
  onConfirm: (d: ContractDecision) => void;
  onClose: () => void;
}
function RequestModal({ contractId, pendingItems, runId, onConfirm, onClose }: RequestModalProps) {
  const [items, setItems] = useState<string[]>(pendingItems.length > 0 ? pendingItems : ['']);
  const [note, setNote] = useState('');

  function updateItem(i: number, v: string) { setItems(prev => prev.map((x, idx) => idx === i ? v : x)); }
  function addItem() { setItems(prev => [...prev, '']); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  const validItems = items.filter(x => x.trim());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-slate-700 rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <ClipboardList size={18} /> Yêu cầu bổ sung — {contractId}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600">
            Danh sách tài liệu / hành động cần bổ sung. Hệ thống tự điền từ checklist chưa xử lý — bạn có thể chỉnh sửa trước khi gửi.
          </p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="mt-2.5 text-xs font-bold text-slate-400 w-5 shrink-0">{i + 1}.</span>
                <input
                  value={item} onChange={e => updateItem(i, e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Mô tả tài liệu / hành động cần bổ sung..."
                />
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="mt-2 text-slate-300 hover:text-red-400"><X size={15} /></button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addItem} className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1">
            + Thêm mục
          </button>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ghi chú cho đối tác / đội hồ sơ</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Deadline, người liên hệ, hướng dẫn thêm..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3 shrink-0 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button
            disabled={validItems.length === 0}
            onClick={() => onConfirm({
              contractId, action: 'YEU_CAU_BO_SUNG', timestamp: new Date().toISOString(),
              runId, requestItems: validItems, requestNote: note.trim() || undefined,
            })}
            className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
          >
            📋 Gửi yêu cầu bổ sung
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step Card ────────────────────────────────────────────────────────────────
function StepCard({ step, expanded, onToggle }: { step: { agent: string; status: string; summary: string; has_warning: boolean }; expanded: boolean; onToggle: () => void }) {
  const ok = step.status === 'completed';
  const warn = step.has_warning;
  return (
    <div className={`border rounded-xl overflow-hidden ${warn ? 'border-amber-200' : ok ? 'border-green-200' : 'border-slate-200'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left ${warn ? 'bg-amber-50' : ok ? 'bg-green-50' : 'bg-slate-50'}`}
      >
        {ok && !warn && <CheckCircle size={16} className="text-green-500 shrink-0" />}
        {warn && <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
        {!ok && <Clock size={16} className="text-slate-400 shrink-0" />}
        <span className="font-semibold text-sm flex-1 text-slate-800">{step.agent}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {step.status}
        </span>
        {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="px-5 pt-4 pb-5 bg-white border-t border-slate-100">
          {renderMd(step.summary || 'Không có thông tin chi tiết.')}
        </div>
      )}
    </div>
  );
}

// ── Zone Header — 3 vùng bắt buộc: Input Data / Agent Workflow / Decision Dashboard ──
function ZoneHeader({ number, title, subtitle, icon: Icon, accent }: {
  number: string; title: string; subtitle: string; icon: LucideIcon; accent: string;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm ${accent}`}>
        {number}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-slate-400 shrink-0" />
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase truncate">{title}</h2>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

function formatM(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
  return `${(v / 1e6).toFixed(0)}M`;
}

function cashBarColor(status: string) {
  if (status === 'CRITICAL') return '#ef4444';
  if (status === 'WARNING') return '#f59e0b';
  return '#22c55e';
}

const DATA_CONFIDENCE_STYLE: Record<string, string> = {
  Verified: 'bg-green-100 text-green-700 border-green-200',
  Partial: 'bg-amber-100 text-amber-700 border-amber-200',
  Estimated: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ── Vùng 1: Dữ liệu đầu vào (Input Data) ──────────────────────────────────────
function InputDataZone({ zoneInput }: { zoneInput: AnalysisResult['zone_input'] }) {
  const cashflow = zoneInput.cashflow_chart || [];
  const criticalMonths = cashflow.filter(c => c.status === 'CRITICAL').length;
  const warningMonths = cashflow.filter(c => c.status === 'WARNING').length;
  const confStyle = DATA_CONFIDENCE_STYLE[zoneInput.data_confidence] || DATA_CONFIDENCE_STYLE.Estimated;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-blue-50/60 to-transparent">
        <ZoneHeader
          number="01"
          title="Dữ liệu đầu vào"
          subtitle="Input Data · nguồn Google Sheets OPC_CoreData / OPC_FinancialData"
          icon={Database}
          accent="bg-blue-600"
        />
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${confStyle}`}>
          Độ tin cậy dữ liệu: {zoneInput.data_confidence}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3.5 flex items-center gap-3">
            <span className={`p-2 rounded-lg bg-white shrink-0 ${criticalMonths > 0 ? 'text-red-500' : 'text-green-500'}`}>
              <AlertTriangle size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-800 leading-tight">{criticalMonths}</div>
              <div className="text-xs text-slate-500 truncate">tháng CRITICAL · {warningMonths} WARNING</div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3.5 flex items-center gap-3">
            <span className="p-2 rounded-lg bg-white shrink-0 text-red-500"><TrendingDown size={16} /></span>
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-800 leading-tight">{formatM(zoneInput.receivables?.open_vnd || 0)}</div>
              <div className="text-xs text-slate-500 truncate">Công nợ phải thu chưa thanh toán</div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3.5 flex items-center gap-3">
            <span className="p-2 rounded-lg bg-white shrink-0 text-amber-500"><TrendingUp size={16} /></span>
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-800 leading-tight">{formatM(zoneInput.receivables?.pipeline_vnd || 0)}</div>
              <div className="text-xs text-slate-500 truncate">Giá trị dự kiến chưa xuất hóa đơn</div>
            </div>
          </div>
        </div>

        {cashflow.length > 0 && (
          <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Dòng tiền dự báo theo tháng</span>
              <span className="text-xs text-slate-400">Ngưỡng tối thiểu: 550M VND</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={cashflow} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v / 1e6}M`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v) => formatM(Number(v))}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                <ReferenceLine y={550_000_000} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="projected_closing_cash" radius={[3, 3, 0, 0]} maxBarSize={36}>
                  {cashflow.map((entry: CashflowMonth, index: number) => (
                    <Cell key={index} fill={cashBarColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function Pipeline() {
  const { selectedContract, setSelectedContract, crisisResolved, setCrisisResolved,
          setLastResult, setIsRunning, isRunning, analysisHistory, setAnalysisHistory,
          addNotification, runLog, addRunEntry, runResults, addRunResult,
          contractDecisions, saveDecision, clearDecision } = useApp();
  const { runAnalysis, getContracts, extractContract, getCustomers, confirmContract, nextContractId, nextCustomerId } = useApi();
  const location = useLocation();

  // Fetch contract list động từ backend
  const [contractList, setContractList] = useState<string[]>(CONTRACTS_FALLBACK);
  useEffect(() => {
    getContracts()
      .then(data => {
        const ids = data.map(c => c.contract_id).filter(Boolean);
        if (ids.length > 0) setContractList(ids);
      })
      .catch(() => {});
  }, []);

  // Đọc ?contract=CON-XXX từ URL (gửi từ email link)
  // Luôn chạy lại phân tích mới nhất khi vào từ email — không dùng cache cũ
  const [autoRunDone, setAutoRunDone] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cid = params.get('contract');
    if (!cid || autoRunDone) return;
    setAutoRunDone(true);
    setSelectedContract(cid);
    setIsRunning(true);
    setError(null);
    runAnalysis(cid, false, [])
      .then(data => {
        setLastResult(data);
        setAnalysisHistory(h => ({ ...h, [cid]: data }));
        const rec = data.zone_decision?.recommendation ?? '';
        const alerts = data.zone_decision?.risk_alerts ?? [];
        const runId = addRunEntry({
          contractId: cid,
          timestamp: new Date().toISOString(),
          recommendation: rec,
          confidence: data.zone_decision?.confidence_score ?? 0,
          alertCount: alerts.length,
          resolvedCount: 0,
        });
        addRunResult(runId, data);
      })
      .catch(e => {
        const msg = e instanceof Error ? e.message : 'Lỗi kết nối backend';
        setError(msg);
      })
      .finally(() => setIsRunning(false));
  }, [location.search]);

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [error, setError] = useState<string | null>(null);
  const [runningStep, setRunningStep] = useState<number>(-1);
  const [activeModal, setActiveModal] = useState<ResolutionDetail | null>(null);
  // Decision modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // ── Đầu vào: hợp đồng có sẵn hay thêm mới từ PDF ────────────────────────────
  const [inputMode, setInputMode] = useState<'existing' | 'pdf'>('existing');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedContract | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [resolvingCustomer, setResolvingCustomer] = useState(false);

  const [newContractId, setNewContractId] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [matchedCustomerName, setMatchedCustomerName] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newContractValue, setNewContractValue] = useState('');
  const [newGrossMargin, setNewGrossMargin] = useState('');
  const [marginFormula, setMarginFormula] = useState<string | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPaymentTerms, setNewPaymentTerms] = useState('');

  // Sinh sẵn mã hợp đồng tiếp theo khi chuyển sang chế độ "Thêm từ PDF"
  useEffect(() => {
    if (inputMode === 'pdf' && !newContractId) {
      nextContractId().then(setNewContractId).catch(() => {});
    }
  }, [inputMode]);

  async function handleExtractPdf() {
    if (!pdfFile) return;
    setPdfError(null);
    setExtracting(true);
    setExtracted(null);
    try {
      const result = await extractContract(pdfFile);
      setExtracted(result);
      setNewContractValue(result.contract_value != null ? String(result.contract_value) : '');
      setNewStartDate(result.start_date || '');
      setNewEndDate(result.end_date || '');
      setNewDescription(result.description || '');
      setNewPaymentTerms(result.payment_terms || '');
      setNewGrossMargin(result.computed_gross_margin != null ? String(result.computed_gross_margin) : '');
      setMarginFormula(result.margin_formula);

      setResolvingCustomer(true);
      try {
        if (result.matched_customer_id) {
          const list: Customer[] = await getCustomers();
          const found = list.find(c => c.customer_id === result.matched_customer_id);
          setNewCustomerId(result.matched_customer_id);
          setMatchedCustomerName(found?.customer_name || result.customer_name || '');
          setIsNewCustomer(false);
        } else {
          const newId = await nextCustomerId();
          setNewCustomerId(newId);
          setMatchedCustomerName(result.customer_name || '(chưa xác định tên)');
          setIsNewCustomer(true);
        }
      } finally {
        setResolvingCustomer(false);
      }
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'Lỗi trích xuất PDF');
    } finally {
      setExtracting(false);
    }
  }

  const canSavePdf = Boolean(
    newContractId.trim() && newCustomerId && newContractValue && newGrossMargin && newStartDate && newEndDate && !resolvingCustomer
  );

  function resetPdfForm() {
    setPdfFile(null);
    setExtracted(null);
    setNewContractId('');
    setNewCustomerId('');
    setMatchedCustomerName('');
    setIsNewCustomer(false);
    setNewContractValue('');
    setNewGrossMargin('');
    setMarginFormula(null);
    setNewStartDate('');
    setNewEndDate('');
    setNewDescription('');
    setNewPaymentTerms('');
  }

  async function handleSaveAndAnalyzePdf() {
    if (!canSavePdf) return;
    setPdfError(null);
    setSavingPdf(true);
    try {
      const data = await confirmContract({
        contract_id: newContractId.trim(),
        customer_id: newCustomerId,
        contract_value: parseFloat(newContractValue),
        gross_margin: parseFloat(newGrossMargin),
        start_date: newStartDate,
        end_date: newEndDate,
        description: newDescription,
        payment_terms: newPaymentTerms,
        status: 'Active',
        ...(isNewCustomer ? { new_customer_name: matchedCustomerName } : {}),
      });
      const cid = newContractId.trim();
      setContractList(prev => prev.includes(cid) ? prev : [...prev, cid]);
      setSelectedContract(cid);
      setSelectedRunId(null);
      setLastResult(data);
      setAnalysisHistory(h => ({ ...h, [cid]: data }));
      const runId = addRunEntry({
        contractId: cid,
        timestamp: new Date().toISOString(),
        recommendation: data.zone_decision.recommendation,
        confidence: data.zone_decision.confidence_score,
        alertCount: (data.zone_decision.risk_alerts || []).length,
        resolvedCount: 0,
      });
      setLatestRunId(runId);
      addRunResult(runId, data);
      addNotification({
        type: 'info',
        title: `Đã thêm hợp đồng ${cid} từ PDF`,
        message: `Khuyến nghị: ${data.zone_decision.recommendation} — Độ tin cậy ${(data.zone_decision.confidence_score * 100).toFixed(0)}%`,
      });
      resetPdfForm();
      setInputMode('existing');
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'Lỗi lưu hợp đồng');
    } finally {
      setSavingPdf(false);
    }
  }

  // Checklist resolved state — persisted per contract in localStorage
  const storageKey = `checklist_resolved_${selectedContract}`;
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Credit missing items resolved state — for CHUA_DU_DU_LIEU contracts
  const [resolvedCreditItems, setResolvedCreditItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`credit_resolved_${selectedContract}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Reload from localStorage when contract changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`checklist_resolved_${selectedContract}`);
      setResolvedIds(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch { setResolvedIds(new Set()); }
    try {
      const saved = localStorage.getItem(`credit_resolved_${selectedContract}`);
      setResolvedCreditItems(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch { setResolvedCreditItems(new Set()); }
  }, [selectedContract]);

  function toggleResolved(recordId: string) {
    setResolvedIds(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      localStorage.setItem(`checklist_resolved_${selectedContract}`, JSON.stringify([...next]));
      return next;
    });
  }

  function toggleCreditItem(key: string) {
    setResolvedCreditItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(`credit_resolved_${selectedContract}`, JSON.stringify([...next]));
      return next;
    });
  }

  // Track the run ID of the most recent run for this session (used by decision modals)
  const [latestRunId, setLatestRunId] = useState<string | undefined>();

  // Select a historical run: restore its crisis + checklist snapshot into live state (no localStorage write)
  function selectRun(entry: typeof runLog[0]) {
    setSelectedContract(entry.contractId);
    setSelectedRunId(entry.id);
    if (entry.crisisResolved != null) setCrisisResolved(entry.crisisResolved);
    if (entry.resolvedIds != null) setResolvedIds(new Set(entry.resolvedIds));
  }

  // Deselect: go back to live state for current contract
  function deselectRun() {
    setSelectedRunId(null);
    try {
      const saved = localStorage.getItem(`checklist_resolved_${selectedContract}`);
      setResolvedIds(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch { setResolvedIds(new Set()); }
  }

  // Nếu đang xem lịch sử: ưu tiên full result của run đó, fallback về analysisHistory của contract đó
  const selectedEntry = selectedRunId ? runLog.find(e => e.id === selectedRunId) : null;
  const result: AnalysisResult | undefined = isRunning
    ? undefined  // Đang chạy → không hiện kết quả cũ (tránh hiển thị data của contract khác)
    : selectedRunId
      ? (runResults[selectedRunId] ?? (selectedEntry ? analysisHistory[selectedEntry.contractId] : undefined))
      : analysisHistory[selectedContract];
  const viewingHistorical = selectedRunId != null && result != null;
  const historicalEntry = viewingHistorical ? selectedEntry : null;
  // True only when we have the EXACT stored result for that run; false = fallback mode
  const hasExactResult = selectedRunId != null && runResults[selectedRunId] != null;

  // Active decision for the currently selected contract
  const activeDecision = contractDecisions[selectedContract];

  async function handleRun() {
    setError(null);
    setIsRunning(true);
    setRunningStep(0);
    try {
      const stepDelay = (ms: number) => new Promise(r => setTimeout(r, ms));
      setRunningStep(1);
      await stepDelay(800);
      setRunningStep(2);
      await stepDelay(600);
      setRunningStep(3);

      const data = await runAnalysis(selectedContract, crisisResolved, [...resolvedIds], [...resolvedCreditItems]);
      setLastResult(data);
      setAnalysisHistory(h => ({ ...h, [selectedContract]: data }));
      setSelectedRunId(null); // reset to show latest
      const runId = addRunEntry({
        contractId: selectedContract,
        timestamp: new Date().toISOString(),
        recommendation: data.zone_decision.recommendation,
        confidence: data.zone_decision.confidence_score,
        alertCount: (data.zone_decision.risk_alerts || []).length,
        resolvedCount: resolvedIds.size,
        // Snapshot state at run time for accurate historical restore
        crisisResolved,
        resolvedIds: [...resolvedIds],
      });
      setLatestRunId(runId);
      addRunResult(runId, data);
      addNotification({
        type: 'info',
        title: `Phân tích ${selectedContract} hoàn tất`,
        message: `Kết quả: ${data.zone_decision.recommendation}. Độ tin cậy: ${(data.zone_decision.confidence_score * 100).toFixed(0)}%`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi kết nối backend';
      setError(msg);
      addNotification({ type: 'warning', title: 'Lỗi phân tích', message: msg });
    } finally {
      setIsRunning(false);
      setRunningStep(-1);
    }
  }

  const rec = result?.zone_decision?.recommendation;
  const decision = result?.zone_decision;

  // Tích lũy checklist từ tất cả lần chạy của hợp đồng — item cũ không bao giờ bị mất
  const allStoredChecklists = runLog
    .filter(e => e.contractId === selectedContract && runResults[e.id])
    .flatMap(e => runResults[e.id].zone_decision?.approval_checklist ?? []);
  const seenTexts = new Set<string>();
  const mergedChecklist: string[] = [];
  for (const item of [...(decision?.approval_checklist ?? []), ...allStoredChecklists]) {
    const text = item.replace(/^\[[ x]\] /, '').trim();
    if (!seenTexts.has(text)) { seenTexts.add(text); mergedChecklist.push(item); }
  }
  const checklistParsed = mergedChecklist.map(parseChecklistItem);
  const pendingItems = checklistParsed
    .filter(c => !resolvedIds.has(c.recordId))
    .map(c => c.text);

  function handleDecisionSaved(d: ContractDecision) {
    saveDecision(d);
    setShowConfirmModal(false);
    setShowRejectModal(false);
    setShowRequestModal(false);
    const labels: Record<string, string> = {
      KY: '✅ Đã xác nhận ký hợp đồng',
      TU_CHOI: '❌ Đã từ chối hợp đồng',
      YEU_CAU_BO_SUNG: '📋 Đã gửi yêu cầu bổ sung',
    };
    addNotification({
      type: d.action === 'KY' ? 'info' : d.action === 'TU_CHOI' ? 'warning' : 'info',
      title: `${labels[d.action]} ${d.contractId}`,
      message: d.action === 'TU_CHOI'
        ? `Lý do: ${d.rejectReason}`
        : d.action === 'YEU_CAU_BO_SUNG'
        ? `${d.requestItems?.length ?? 0} mục cần bổ sung đã ghi nhận`
        : `Confidence ${((d.confidence ?? 0) * 100).toFixed(0)}% — Quyết định đã lưu`,
    });
  }

  const REC_COLORS_MINI: Record<string, string> = {
    KY: 'text-green-600',
    KY_CO_DIEU_KIEN: 'text-amber-600',
    KHONG_KY: 'text-red-600',
    CHUA_DU_DATA: 'text-slate-500',
    CHUA_DU_DU_LIEU: 'text-slate-500',
  };
  const REC_SHORT: Record<string, string> = {
    KY: '✅ KÝ', KY_CO_DIEU_KIEN: '⚠️ CÓ ĐK', KHONG_KY: '❌ KHÔNG KÝ',
    CHUA_DU_DATA: '⏳ CHƯA ĐỦ DL', CHUA_DU_DU_LIEU: '⏳ CHƯA ĐỦ DL',
  };

  return (
    <div className="flex gap-4 items-start">
    {/* ── Main content ─────────────────────────────────────────────── */}
    <div className="flex-1 min-w-0 space-y-5">
      {/* Resolution Modal */}
      {activeModal && <ResolutionModal detail={activeModal} onClose={() => setActiveModal(null)} />}
      {showConfirmModal && decision && (
        <ConfirmSignModal
          contractId={selectedContract}
          decision={decision}
          resolvedCount={resolvedIds.size}
          totalChecklist={checklistParsed.length}
          runId={latestRunId}
          onConfirm={handleDecisionSaved}
          onClose={() => setShowConfirmModal(false)}
        />
      )}
      {showRejectModal && (
        <RejectModal
          contractId={selectedContract}
          runId={latestRunId}
          onConfirm={handleDecisionSaved}
          onClose={() => setShowRejectModal(false)}
        />
      )}
      {showRequestModal && (
        <RequestModal
          contractId={selectedContract}
          pendingItems={pendingItems}
          runId={latestRunId}
          onConfirm={handleDecisionSaved}
          onClose={() => setShowRequestModal(false)}
        />
      )}

      {/* Controls — nguồn đầu vào: hợp đồng có sẵn hoặc thêm mới từ PDF */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInputMode('existing')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'existing' ? 'bg-brand-800 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListChecks size={14} /> Hợp đồng có sẵn
          </button>
          <button
            onClick={() => setInputMode('pdf')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'pdf' ? 'bg-brand-800 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UploadCloud size={14} /> Thêm mới từ PDF
          </button>
        </div>

        {inputMode === 'existing' ? (
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[160px] max-w-[260px] flex-shrink-0">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hợp đồng</label>
              <select
                value={selectedContract}
                onChange={e => setSelectedContract(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              >
                {contractList.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {result?.zone_workflow.crisis_layer.active && rec !== 'CHUA_DU_DU_LIEU' && rec !== 'KHONG_KY' && (
              <div className="flex items-center gap-2 pb-1">
                <label className="text-xs font-semibold text-slate-600">Đã xử lý giao dịch nghi vấn</label>
                <button
                  onClick={() => setCrisisResolved(!crisisResolved)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${crisisResolved ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${crisisResolved ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="text-xs text-slate-500">{crisisResolved ? 'Đã xử lý' : 'Chưa xử lý'}</span>
              </div>
            )}

            {resolvedIds.size > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 font-medium">
                <CheckCircle size={12} />
                {resolvedIds.size} mục đã xử lý — sẽ áp dụng khi chạy lại
                <button
                  onClick={() => { setResolvedIds(new Set()); localStorage.removeItem(`checklist_resolved_${selectedContract}`); }}
                  className="ml-1 text-green-500 hover:text-red-500 transition-colors"
                  title="Xóa tất cả"
                >
                  <X size={11} />
                </button>
              </div>
            )}

            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 disabled:bg-brand-800/60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {isRunning ? <Loader size={15} className="animate-spin" /> : <Play size={15} />}
              {isRunning ? `Đang chạy bước ${runningStep}/3…` : 'Chạy phân tích'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles size={13} className="text-brand-600 shrink-0" />
              Upload file hợp đồng gốc — Agent tự đọc, trích xuất dữ liệu, tự sinh mã hợp đồng và đối chiếu khách hàng. Bạn xem lại trước khi lưu &amp; phân tích.
            </div>

            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-500 cursor-pointer hover:border-brand-400 hover:bg-slate-50">
                <UploadCloud size={16} className="shrink-0" />
                <span className="truncate">{pdfFile ? pdfFile.name : 'Chọn file PDF hợp đồng...'}</span>
                <input
                  type="file" accept="application/pdf" className="hidden"
                  onChange={e => setPdfFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                onClick={handleExtractPdf}
                disabled={!pdfFile || extracting}
                className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 disabled:bg-brand-800/50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shrink-0"
              >
                {extracting ? <Loader size={15} className="animate-spin" /> : <FileCheck size={15} />}
                {extracting ? 'Đang trích xuất…' : 'Trích xuất dữ liệu'}
              </button>
            </div>

            {pdfError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {pdfError}
              </div>
            )}

            {extracted && (
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Dữ liệu trích xuất — xem lại và bổ sung trước khi lưu</h3>

                {extracted.missing_fields.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <div className="font-semibold mb-1">AI không tìm thấy các trường sau trong PDF — cần bạn tự điền:</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {extracted.missing_fields.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                    <div className="text-xs text-slate-500 mb-0.5">Mã hợp đồng (tự sinh)</div>
                    <div className="text-sm font-semibold text-slate-800">{newContractId || '…'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                    <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                      {resolvingCustomer ? (
                        <><Loader size={11} className="animate-spin" /> Đang đối chiếu khách hàng…</>
                      ) : isNewCustomer ? (
                        <><UserPlus size={11} className="text-amber-500" /> Khách hàng mới — sẽ tự tạo khi lưu</>
                      ) : (
                        <><UserCheck size={11} className="text-green-500" /> Đã khớp khách hàng có sẵn</>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {newCustomerId ? `${newCustomerId} — ${matchedCustomerName}` : '…'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Giá trị hợp đồng (VND) <span className="text-red-500">*</span></label>
                    <input
                      type="number" value={newContractValue} onChange={e => setNewContractValue(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Gross margin (0-1) <span className="text-red-500">*</span>
                      {marginFormula ? (
                        <span className="font-normal text-green-600 ml-1">— tự tính từ chi phí trong PDF</span>
                      ) : (
                        <span className="font-normal text-slate-400 ml-1">— không có trong PDF, tự nhập theo chi phí nội bộ</span>
                      )}
                    </label>
                    <input
                      type="number" step="0.01" min="0" max="1" value={newGrossMargin}
                      onChange={e => { setNewGrossMargin(e.target.value); setMarginFormula(null); }}
                      placeholder="VD: 0.28"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                    {marginFormula && (
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-slate-500">
                        <Calculator size={12} className="shrink-0 mt-0.5 text-green-600" />
                        <span>{marginFormula}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ngày bắt đầu <span className="text-red-500">*</span></label>
                    <input
                      type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ngày kết thúc <span className="text-red-500">*</span></label>
                    <input
                      type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mô tả</label>
                    <textarea
                      value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Điều khoản thanh toán</label>
                    <textarea
                      value={newPaymentTerms} onChange={e => setNewPaymentTerms(e.target.value)} rows={3}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveAndAnalyzePdf}
                  disabled={!canSavePdf || savingPdf}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {savingPdf ? <Loader size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  {savingPdf ? 'Đang lưu và phân tích (có thể mất 40-90 giây)…' : 'Lưu & Phân tích'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-start gap-2">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Lỗi kết nối backend</div>
            <div className="mt-0.5">{error}</div>
            <div className="mt-1 text-xs text-red-500">Đảm bảo FastAPI đang chạy tại http://localhost:8000</div>
          </div>
        </div>
      )}

      {/* Historical view banner */}
      {viewingHistorical && historicalEntry && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Đang xem lịch sử: </span>
            {historicalEntry.contractId} · {new Date(historicalEntry.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
            {!hasExactResult && (
              <span className="ml-2 text-xs text-amber-600 italic">
                (kết quả tham chiếu — dữ liệu chính xác của lần chạy này không còn trong bộ nhớ)
              </span>
            )}
          </div>
          <button
            onClick={() => deselectRun()}
            className="text-xs font-medium text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100 whitespace-nowrap"
          >
            ← Về kết quả mới nhất
          </button>
        </div>
      )}

      {/* Run History (inline collapsible) */}
      {(() => {
        const contractLog = runLog.filter(e => e.contractId === selectedContract);
        if (contractLog.length === 0) return null;
        return (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
            >
              <History size={15} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Lịch sử phân tích</span>
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded ml-1">{selectedContract}</span>
              <span className="ml-auto text-xs text-slate-400 mr-2">{contractLog.length} lần chạy</span>
              {showHistory ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {showHistory && (
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold">
                      <th className="text-left px-4 py-2.5">Thời gian</th>
                      <th className="text-left px-4 py-2.5">Kết quả</th>
                      <th className="text-right px-4 py-2.5">Độ tin cậy</th>
                      <th className="text-right px-4 py-2.5">Cảnh báo</th>
                      <th className="text-right px-4 py-2.5">Đã xử lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contractLog.map(entry => {
                      const rowHasExact = runResults[entry.id] != null;
                      const rowCanView = rowHasExact || analysisHistory[entry.contractId] != null;
                      return (
                      <tr
                        key={entry.id}
                        onClick={() => rowCanView ? (selectedRunId === entry.id ? deselectRun() : selectRun(entry)) : undefined}
                        className={`transition-colors ${rowCanView ? 'cursor-pointer hover:bg-slate-50' : 'opacity-40 cursor-default'} ${
                          selectedRunId === entry.id ? 'bg-brand-50' : ''
                        }`}
                        title={rowHasExact ? 'Xem kết quả chính xác lần chạy này' : rowCanView ? 'Xem kết quả tham chiếu (dữ liệu lần chạy không còn trong bộ nhớ)' : 'Không có dữ liệu'}
                      >
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                          {selectedRunId === entry.id && (
                            <span className="ml-1.5 text-brand-600 font-semibold">← đang xem</span>
                          )}
                          {!rowHasExact && rowCanView && selectedRunId !== entry.id && (
                            <span className="ml-1 text-amber-400 text-xs">*</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`font-semibold ${
                            entry.recommendation === 'KY' ? 'text-green-600'
                            : entry.recommendation === 'KY_CO_DIEU_KIEN' ? 'text-amber-600'
                            : entry.recommendation === 'KHONG_KY' ? 'text-red-600'
                            : 'text-slate-500'
                          }`}>
                            {entry.recommendation === 'KY' ? '✅ KÝ'
                              : entry.recommendation === 'KY_CO_DIEU_KIEN' ? '⚠️ CÓ ĐIỀU KIỆN'
                              : entry.recommendation === 'KHONG_KY' ? '❌ KHÔNG KÝ'
                              : '❓ THIẾU DỮ LIỆU'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{(entry.confidence * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{entry.alertCount}</td>
                        <td className="px-4 py-2.5 text-right text-green-600 font-medium">{entry.resolvedCount}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Vùng 1 — Dữ liệu đầu vào (Input Data) */}
      {result && <InputDataZone zoneInput={result.zone_input} />}

      {/* Vùng 2 — Luồng Agent (Agent Workflow) */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-transparent">
            <ZoneHeader
              number="02"
              title="Quy trình phân tích"
              subtitle="Tài chính → Rủi ro và tuân thủ → Thông tin phi tài chính → Tham mưu quyết định"
              icon={GitBranch}
              accent="bg-indigo-600"
            />
          </div>
          <div className="p-5 space-y-4">
            {/* Crisis Layer */}
            <div className={`rounded-xl border p-5 ${result.zone_workflow.crisis_layer.active
              ? (crisisResolved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
              : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 mb-2">
                {result.zone_workflow.crisis_layer.active
                  ? (crisisResolved ? <CheckCircle size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500" />)
                  : <CheckCircle size={16} className="text-slate-400" />}
                Crisis Layer
                {result.zone_workflow.crisis_layer.active && !crisisResolved && (
                  <span className="ml-2 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full font-medium">ĐANG CẢNH BÁO</span>
                )}
                {crisisResolved && (
                  <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-medium">ĐÃ XỬ LÝ</span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {result.zone_workflow.crisis_layer.active
                  ? (() => {
                      const txnIds = result.zone_workflow.crisis_layer.alert?.txn_ids ?? [];
                      const list = txnIds.join(', ') || 'N/A';
                      return crisisResolved
                        ? `Founder đã xác nhận xử lý ${list}. Pipeline tiếp tục với điều kiện các mục khác được hoàn thành.`
                        : `${list} có điểm rủi ro > 85 — cần Founder xác nhận. Bật "Crisis resolved" sau khi đã xử lý với ngân hàng.`;
                    })()
                  : 'Không có giao dịch đáng ngờ nào được phát hiện.'}
              </p>
            </div>

            {/* Pipeline steps */}
            <div className="space-y-3">
              {result.zone_workflow.pipeline.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  expanded={expandedSteps.has(i)}
                  onToggle={() => setExpandedSteps(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vùng 3 — Bảng quyết định (Decision Dashboard) */}
      {decision && rec && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-transparent">
            <ZoneHeader
              number="03"
              title="Bảng quyết định"
              subtitle="Bảng tham mưu quyết định · Chuyên viên tham mưu"
              icon={Target}
              accent="bg-emerald-600"
            />
          </div>
        <div className="p-5 space-y-4">
          <div className={`rounded-xl border-2 p-5 ${REC_COLORS[rec]}`}>
            {/* Header: trạng thái + confidence */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="text-2xl font-extrabold tracking-tight">{REC_LABELS[rec] ?? rec}</div>
              <div className={`text-lg font-bold px-4 py-1 rounded-full border-2 ${REC_COLORS[rec]}`}>
                Độ tin cậy: {(decision.confidence_score * 100).toFixed(0)}%
              </div>
            </div>
            {decision.narrative && (
              <div className="text-sm leading-relaxed opacity-90 border-t border-current/20 pt-3">
                {renderMd(decision.narrative, true)}
              </div>
            )}
          </div>

          {result.zone_research?.overall && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Thông tin phi tài chính đưa vào quyết định</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{result.zone_research.overall.decision_support}</div>
                </div>
                <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700">
                  {result.zone_research.overall.sentiment} · Điểm {result.zone_research.overall.sentiment_score}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-blue-100 bg-white/80 p-3">
                  <div className="text-xs font-semibold text-slate-500">DOANH NGHIỆP</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">{result.zone_research.company_report?.subject ?? 'Chưa xác định'}</span>
                    <span className="font-semibold text-blue-700">{result.zone_research.company_report?.sentiment ?? 'Chưa đủ dữ liệu'}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{result.zone_research.company_report?.executive_summary}</p>
                  {result.zone_research.company_report?.identity_status && <p className="mt-1 text-xs font-medium text-amber-700">Định danh: {result.zone_research.company_report.identity_status}</p>}
                </div>
                <div className="rounded-lg border border-blue-100 bg-white/80 p-3">
                  <div className="text-xs font-semibold text-slate-500">THỊ TRƯỜNG</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">{result.zone_research.market_report?.subject ?? 'Chưa xác định'}</span>
                    <span className="font-semibold text-blue-700">{result.zone_research.market_report?.sentiment ?? 'Chưa đủ dữ liệu'}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{result.zone_research.market_report?.executive_summary}</p>
                  <p className="mt-1 text-xs text-slate-500">Đã đối chiếu {result.zone_research.market_report?.sources?.length ?? 0} nguồn công khai.</p>
                </div>
              </div>

              {[
                ...(result.zone_research.company_report?.negative_signals ?? []),
                ...(result.zone_research.market_report?.negative_signals ?? []),
                ...(result.zone_research.company_report?.positive_signals ?? []),
                ...(result.zone_research.market_report?.positive_signals ?? []),
              ].slice(0, 3).length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Tín hiệu đáng lưu ý</div>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {[
                      ...(result.zone_research.company_report?.negative_signals ?? []),
                      ...(result.zone_research.market_report?.negative_signals ?? []),
                      ...(result.zone_research.company_report?.positive_signals ?? []),
                      ...(result.zone_research.market_report?.positive_signals ?? []),
                    ].slice(0, 3).map((signal, index) => <li key={`${signal}-${index}`}>• {signal}</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-3 rounded-lg bg-blue-100/70 px-3 py-2 text-xs text-blue-900">
                <strong>Ảnh hưởng đến khuyến nghị:</strong> {result.zone_research.overall.impact_summary ?? 'Kết quả được sử dụng để hiệu chỉnh độ tin cậy và điều kiện phê duyệt.'}
                {typeof result.zone_research.overall.confidence_adjustment === 'number' && result.zone_research.overall.confidence_adjustment !== 0 && (
                  <span> Độ tin cậy điều chỉnh {(result.zone_research.overall.confidence_adjustment * 100).toFixed(0)} điểm phần trăm.</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {[
                  ...(result.zone_research.company_report?.sources ?? []),
                  ...(result.zone_research.market_report?.sources ?? []),
                ].slice(0, 3).map((source, index) => (
                  <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                    Nguồn {index + 1}: {source.publisher}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Điều kiện bảo vệ — 1 điều kiện duy nhất, nổi bật, đi kèm phương án + 3 lý do */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <span className="p-2 rounded-lg bg-white text-amber-600 shrink-0"><Shield size={16} /></span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Điều kiện bảo vệ</div>
              <p className="text-sm text-amber-900 leading-relaxed">{decision.guard_condition}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Reasons */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Ba lý do chính ({(decision.three_reasons || []).length})</h3>
              <ol className="space-y-3">
                {(decision.three_reasons || []).map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5 leading-relaxed">
                    <span className="font-bold text-brand-800 shrink-0 w-5">{i + 1}.</span>
                    <span className="flex-1">
                      {renderMd(r.text)}
                      <span className="block text-xs text-slate-400 mt-1">
                        Nguồn: {r.source_sheet}.{r.source_cell}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Alerts — flex column, tự stretch theo chiều cao cột trái */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 shrink-0">
                Cảnh báo rủi ro ({(decision.risk_alerts || []).length})
                {resolvedIds.size > 0 && (
                  <span className="ml-2 text-xs text-green-600 font-normal">
                    ({resolvedIds.size} đã xử lý — sẽ bỏ qua khi chạy lại)
                  </span>
                )}
              </h3>
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                {(decision.risk_alerts || []).map(a => (
                  <div key={a.alert_id} className={`flex items-start gap-2 text-xs text-slate-600 rounded px-1 py-0.5 ${resolvedIds.has(a.related_record) || resolvedIds.has(a.alert_id) ? 'opacity-40 line-through' : ''}`}>
                    <StatusBadge value={a.severity} size="sm" className="shrink-0 mt-0.5" />
                    <span>{a.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bank options */}
          {(decision.bank_options || []).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                <Banknote size={15} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-slate-800">Phương án tài chính ngân hàng</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 font-medium bg-slate-50">
                    <th className="text-left px-5 py-3">Ngân hàng</th>
                    <th className="text-left px-5 py-3">Sản phẩm</th>
                    <th className="text-right px-5 py-3">Lãi suất</th>
                    <th className="text-right px-5 py-3">Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {decision.bank_options.map((b, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{b.bank}</td>
                      <td className="px-5 py-3 text-slate-600">{b.product_name}</td>
                      <td className="px-5 py-3 text-right text-brand-700 font-semibold">
                        {b.annual_rate ? `${(b.annual_rate * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-semibold text-green-700">{(b.eligibility_score * 100).toFixed(0)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Approval checklist — interactive (KY_CO_DIEU_KIEN only, or read-only for KY) */}
          {checklistParsed.length > 0 && rec !== 'KHONG_KY' && rec !== 'CHUA_DU_DU_LIEU' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <FileCheck size={15} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-slate-800">Danh mục điều kiện phê duyệt</h3>
                <span className="ml-auto text-xs text-slate-400">
                  {resolvedIds.size}/{checklistParsed.length} đã xử lý
                </span>
                {rec === 'KY' && (
                  <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium ml-1">
                    ✅ Đã đủ điều kiện
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {rec === 'KY'
                  ? 'Các mục điều kiện đã hoàn thành — hệ thống đủ tự tin để đề xuất ký hợp đồng.'
                  : 'Tick vào mục đã xử lý xong → chạy lại phân tích để cập nhật kết quả'}
              </p>
              <ul className="space-y-2">
                {checklistParsed.map(({ text, recordId, detail }) => {
                  const done = rec === 'KY' ? true : resolvedIds.has(recordId);
                  return (
                    <li key={recordId} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 border transition-colors ${done ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={rec === 'KY'}
                        onChange={() => rec !== 'KY' && toggleResolved(recordId)}
                        className="mt-0.5 accent-brand-700 shrink-0 w-4 h-4 cursor-pointer disabled:cursor-default"
                      />
                      <span className={`text-xs flex-1 leading-relaxed ${done ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                        {text}
                      </span>
                      {rec !== 'KY' && (
                        <button
                          onClick={() => setActiveModal(detail)}
                          className="shrink-0 text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 rounded-md px-2 py-1 hover:bg-brand-50 transition-colors whitespace-nowrap"
                        >
                          Xem hướng dẫn →
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {rec !== 'KY' && resolvedIds.size > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-green-700 font-medium">
                    ✓ {resolvedIds.size} mục đã xử lý sẽ được bỏ qua trong lần phân tích tiếp theo
                  </p>
                  <button
                    onClick={() => { setResolvedIds(new Set()); localStorage.removeItem(`checklist_resolved_${selectedContract}`); }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Missing items checklist — only for CHUA_DU_DU_LIEU */}
          {rec === 'CHUA_DU_DU_LIEU' && (() => {
            const missingFlat: { key: string; label: string }[] = [];
            if (decision.missing_items) {
              for (const [crId, items] of Object.entries(decision.missing_items)) {
                for (const item of items) {
                  missingFlat.push({ key: `${crId}::${item}`, label: `[${crId}] ${item}` });
                }
              }
            }

            // Khi có danh sách missing items cụ thể từ AI
            if (missingFlat.length > 0) {
              const resolvedCount = missingFlat.filter(m => resolvedCreditItems.has(m.key)).length;
              return (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck size={15} className="text-gray-500" />
                    <h3 className="text-sm font-semibold text-slate-800">Hạng mục còn thiếu — cần bổ sung để tính lại</h3>
                    <span className="ml-auto text-xs text-slate-400">
                      {resolvedCount}/{missingFlat.length} đã bổ sung
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    AI phát hiện các hạng mục chưa hoàn thành trong hồ sơ tín dụng. Tick vào mục đã xử lý xong → chạy lại để tính lại confidence score.
                  </p>
                  <ul className="space-y-2">
                    {missingFlat.map(({ key, label }) => {
                      const done = resolvedCreditItems.has(key);
                      return (
                        <li key={key} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 border transition-colors ${done ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleCreditItem(key)}
                            className="mt-0.5 accent-brand-700 shrink-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={`text-xs flex-1 leading-relaxed ${done ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                            {label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {resolvedCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-xs text-green-700 font-medium">
                        ✓ {resolvedCount} hạng mục đã bổ sung — confidence sẽ được tính lại khi chạy lại
                      </p>
                      <button
                        onClick={() => { setResolvedCreditItems(new Set()); localStorage.removeItem(`credit_resolved_${selectedContract}`); }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Khi không có missing items cụ thể — confidence thấp do điểm tín dụng cơ bản
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="text-gray-500 shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-700">Tại sao chưa đủ dữ liệu?</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Confidence score ({(decision.confidence_score * 100).toFixed(0)}%) thấp hơn ngưỡng 65% do điểm tín dụng cơ bản (eligibility score) của các hồ sơ chưa đạt. Không phát hiện hạng mục thiếu cụ thể trong precheck — hệ thống cần thêm dữ liệu để ra quyết định chính xác.
                </p>
                <p className="text-xs text-slate-500">
                  → Kiểm tra lại hồ sơ tín dụng trong Google Sheets (tab 10_CREDIT_PROFILE), bổ sung precheck_note hoặc nâng eligibility_score, sau đó nhấn <strong>Reload cache</strong> trong Cài đặt và chạy lại phân tích.
                </p>
              </div>
            );
          })()}

          {/* Decision status banner — shows saved decision for this contract */}
          {activeDecision && (!viewingHistorical || activeDecision.runId === selectedRunId) && (
            <div className={`rounded-xl border px-5 py-4 flex items-start justify-between gap-3 ${
              activeDecision.action === 'KY' ? 'bg-green-50 border-green-200 text-green-800'
              : activeDecision.action === 'TU_CHOI' ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="text-sm flex-1">
                {activeDecision.action === 'KY' && (
                  <>
                    <div className="font-bold mb-1">✅ Đã xác nhận ký hợp đồng {activeDecision.contractId}</div>
                    <div className="text-xs opacity-80">
                      Confidence {((activeDecision.confidence ?? 0) * 100).toFixed(0)}% · {new Date(activeDecision.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      <br />Bước tiếp theo: in tờ trình phê duyệt → chuyển kế toán chuẩn bị hồ sơ ngân hàng.
                    </div>
                  </>
                )}
                {activeDecision.action === 'TU_CHOI' && (
                  <>
                    <div className="font-bold mb-1">❌ Đã từ chối hợp đồng {activeDecision.contractId}</div>
                    <div className="text-xs opacity-80">
                      Lý do: {activeDecision.rejectReason}
                      {activeDecision.rejectNote && <> · {activeDecision.rejectNote}</>}
                      <br />{new Date(activeDecision.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </>
                )}
                {activeDecision.action === 'YEU_CAU_BO_SUNG' && (
                  <>
                    <div className="font-bold mb-1">📋 Đã gửi yêu cầu bổ sung — {activeDecision.contractId}</div>
                    <div className="text-xs opacity-80">
                      {activeDecision.requestItems?.length ?? 0} mục · {new Date(activeDecision.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      {activeDecision.requestNote && <> · {activeDecision.requestNote}</>}
                    </div>
                    {activeDecision.requestItems && activeDecision.requestItems.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {activeDecision.requestItems.map((it, i) => (
                          <li key={i} className="text-xs text-blue-700">• {it}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <button onClick={() => clearDecision(selectedContract)} className="shrink-0 opacity-60 hover:opacity-100" title="Xoá quyết định này">
                <RotateCcw size={14} />
              </button>
            </div>
          )}

          {/* Action buttons — conditional per recommendation */}
          {rec === 'KHONG_KY' ? (
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <ThumbsDown size={15} /> Xác nhận từ chối
              </button>
            </div>
          ) : rec === 'CHUA_DU_DU_LIEU' ? (
            <div className="flex gap-3">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isRunning ? <Loader size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                Chạy lại sau khi bổ sung dữ liệu
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                disabled={!decision.confirm_button_enabled}
                onClick={() => setShowConfirmModal(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                title={decision.confirm_button_disabled_reason || ''}
              >
                <PenLine size={15} /> Xác nhận ký hợp đồng
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl transition-colors text-sm border border-red-200 flex items-center gap-2"
              >
                <ThumbsDown size={15} /> Từ chối
              </button>
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-3 rounded-xl transition-colors text-sm border border-slate-200 flex items-center gap-2"
              >
                <ClipboardList size={15} /> Yêu cầu bổ sung
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !isRunning && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm">
          <Play size={32} className="mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500 text-sm font-medium">Chưa có kết quả phân tích</div>
          <div className="text-slate-400 text-xs mt-1">
            {inputMode === 'pdf'
              ? 'Upload PDF, trích xuất dữ liệu rồi bấm "Lưu & Phân tích" để bắt đầu'
              : 'Chọn hợp đồng và nhấn "Chạy phân tích" để bắt đầu'}
          </div>
        </div>
      )}
    </div>{/* end main content */}

    {/* ── History Sidebar ──────────────────────────────────────────── */}
    <div className={`shrink-0 transition-all duration-200 ${showSidebar ? 'w-72' : 'w-8'}`}>
      {/* Toggle button */}
      <button
        onClick={() => setShowSidebar(v => !v)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-sm mb-2"
        title={showSidebar ? 'Thu sidebar' : 'Mở lịch sử'}
      >
        {showSidebar ? (
          <>
            <span className="flex items-center gap-1.5"><History size={13} /> Lịch sử ({runLog.length})</span>
            <ChevronUp size={13} className="rotate-90" />
          </>
        ) : (
          <History size={13} className="mx-auto" />
        )}
      </button>

      {showSidebar && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {runLog.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  ['opc_run_log','opc_run_results','opc_analysis_history','opc_contract_decisions']
                    .forEach(k => localStorage.removeItem(k));
                  // also clear all checklist keys
                  Object.keys(localStorage).filter(k => k.startsWith('checklist_resolved_')).forEach(k => localStorage.removeItem(k));
                  window.location.reload();
                }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Xóa toàn bộ lịch sử
              </button>
            </div>
          )}
          {runLog.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">Chưa có lịch sử</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[calc(100vh-180px)] overflow-y-auto">
              {runLog.map(entry => {
                const isSelected = selectedRunId === entry.id;
                const hasExact = runResults[entry.id] != null;
                const hasFallback = !hasExact && analysisHistory[entry.contractId] != null;
                const canView = hasExact || hasFallback;
                return (
                  <button
                    key={entry.id}
                    onClick={() => canView ? (isSelected ? deselectRun() : selectRun(entry)) : undefined}
                    disabled={!canView}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSelected
                        ? 'bg-brand-50 border-l-4 border-l-brand-600'
                        : canView
                        ? 'hover:bg-slate-50 border-l-4 border-l-transparent cursor-pointer'
                        : 'opacity-40 cursor-default border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-slate-700">{entry.contractId}</span>
                      <span className={`text-xs font-semibold ${REC_COLORS_MINI[entry.recommendation] || 'text-slate-500'}`}>
                        {REC_SHORT[entry.recommendation] || entry.recommendation}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mb-1.5">
                      {new Date(entry.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {(entry.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                        {entry.alertCount} alerts
                      </span>
                      {entry.resolvedCount > 0 && (
                        <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">
                          {entry.resolvedCount} xử lý
                        </span>
                      )}
                    </div>
                    {hasFallback && !isSelected && (
                      <div className="text-xs text-amber-500 mt-1 italic">* kết quả tham chiếu</div>
                    )}
                    {isSelected && (
                      <div className="text-xs text-brand-600 mt-1 font-medium">← Đang xem</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
