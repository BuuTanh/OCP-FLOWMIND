import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, Play, ChevronDown, ChevronUp, ArrowRight, X, Lightbulb, AlertTriangle, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { KpiCard } from '../components/KpiCard';
import type { RiskAlert } from '../types';

// ── Alert Action Modal ───────────────────────────────────────────────────────
const SEV_COLORS: Record<string, string> = {
  Critical: 'bg-red-600',
  High:     'bg-amber-500',
  Medium:   'bg-blue-500',
  Low:      'bg-slate-400',
};
const SEV_BG: Record<string, string> = {
  Critical: 'bg-red-50 border-red-200 text-red-800',
  High:     'bg-amber-50 border-amber-200 text-amber-800',
  Medium:   'bg-blue-50 border-blue-200 text-blue-800',
  Low:      'bg-slate-50 border-slate-200 text-slate-700',
};

function AlertActionModal({
  alert, contractId, onClose, onGoToPipeline,
}: {
  alert: RiskAlert & { contractId: string };
  contractId: string;
  onClose: () => void;
  onGoToPipeline: (cid: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className={`rounded-t-2xl px-6 py-4 flex items-start justify-between gap-3 ${SEV_COLORS[alert.severity]} bg-opacity-90`}>
          <div>
            <div className="flex items-center gap-2 text-white">
              <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded">{alert.alert_id}</span>
              <span className="text-xs font-semibold opacity-80">{alert.rule_id}</span>
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">{alert.severity}</span>
            </div>
            <div className="text-white font-bold text-sm mt-1.5 leading-snug">{alert.description}</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white shrink-0 mt-0.5"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Contract */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText size={13} />
            <span>Hợp đồng: <span className="font-mono font-bold text-brand-800">{contractId}</span></span>
            {alert.related_record && (
              <span className="ml-2">· Liên quan: <span className="font-mono text-slate-600">{alert.related_record}</span></span>
            )}
          </div>

          {/* Recommended action — main content */}
          <div className={`rounded-xl border px-5 py-4 ${SEV_BG[alert.severity]}`}>
            <div className="flex items-center gap-2 text-xs font-semibold mb-2">
              <Lightbulb size={14} />
              Hành động khuyến nghị
            </div>
            <p className="text-sm leading-relaxed font-medium">
              {alert.recommended_action || fallbackAction(alert)}
            </p>
          </div>

          {/* Urgency note for Critical */}
          {alert.severity === 'Critical' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-500" />
              <span>Cảnh báo <strong>Critical</strong> — cần xử lý trước khi pipeline có thể ra quyết định ký hợp đồng.</span>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Đóng
          </button>
          <button
            onClick={() => { onGoToPipeline(contractId); onClose(); }}
            className="flex-1 bg-brand-800 hover:bg-brand-900 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2"
          >
            Xử lý tại Pipeline <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Generate fallback action text when recommended_action is missing
function fallbackAction(alert: RiskAlert): string {
  const r = alert.related_record ? ` (${alert.related_record})` : '';
  switch (alert.rule_id) {
    case 'RR-001': return `Liên hệ ngân hàng xác minh giao dịch${r}. Nếu hợp lệ, cập nhật txn_status = "Normal" trong OPC_FinancialData tab 08_BANK_TXN. Bật "Crisis resolved" trong Pipeline sau khi xử lý xong.`;
    case 'RR-002': return `Rà soát kế hoạch thu chi tháng tới. Xem xét vay vốn ngắn hạn hoặc đẩy nhanh thu hồi công nợ để bù gap cashflow${r}.`;
    case 'RR-003': return `Review cơ cấu chi phí hợp đồng${r}. Đàm phán lại với nhà cung cấp hoặc điều chỉnh giá bán để đưa margin về ≥28%.`;
    case 'RR-004': return `Rà soát chứng từ xuất ra bên ngoài${r}. Yêu cầu hoàn trả hoặc xác nhận bằng văn bản nếu có phát sinh hợp lệ.`;
    case 'RR-005': return `Founder ký duyệt hồ sơ tín dụng${r} theo quy trình nội bộ. Lưu tờ trình phê duyệt vào Drive và cập nhật approval_status trong OPC_FinancialData.`;
    case 'RR-006': return `Bổ sung dữ liệu hoặc đánh giá lại điều kiện tín dụng cho${r} — điểm tin cậy đang dưới ngưỡng khuyến nghị 65%. Cập nhật eligibility_score trong tab 10_CREDIT_PROFILE khi có căn cứ mới.`;
    case 'DOC-CHECK': return `Thu thập và bổ sung chứng từ còn thiếu cho${r}. Cập nhật precheck_note trong tab 10_CREDIT_PROFILE khi đã hoàn chỉnh.`;
    case 'RR-007': return `Xác nhận kế hoạch xử lý với bên vận chuyển/nhà cung cấp cho${r}. Cập nhật delivery_note và trạng thái đơn hàng trong tab 06_ORDERS.`;
    default: return `Xem xét và xử lý cảnh báo${r} theo quy trình nội bộ. Chuyển sang Pipeline để xem hướng dẫn chi tiết và tick hoàn thành trong checklist phê duyệt.`;
  }
}

type SeverityFilter = 'All' | 'Critical' | 'High' | 'Medium';
type RuleId = 'All' | 'RR-001' | 'RR-002' | 'RR-003' | 'RR-004' | 'RR-005' | 'RR-006' | 'RR-007' | 'DOC-CHECK' | '14_ALERTS';

const RULE_LABELS: Record<string, string> = {
  'RR-001': 'TXN rủi ro cao',
  'RR-002': 'Cashflow dưới ngưỡng',
  'RR-003': 'Margin thấp',
  'RR-004': 'Chứng từ ra ngoài',
  'RR-005': 'Khoản vay lớn',
  'RR-006': 'Điểm tin cậy thấp',
  'RR-007': 'Trễ giao hàng',
  'DOC-CHECK': 'Thiếu chứng từ',
  '14_ALERTS': 'Pre-existing alerts',
};

const SEVERITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export function Risks() {
  const navigate = useNavigate();
  const { analysisHistory, setSelectedContract } = useApp();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('All');
  const [ruleFilter, setRuleFilter] = useState<RuleId>('All');
  const [contractFilter, setContractFilter] = useState<string>('All');
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<(RiskAlert & { contractId: string }) | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  // Bump this to force re-read from localStorage after toggling
  const [resolvedVersion, setResolvedVersion] = useState(0);

  // ── Aggregate all alerts from all analysed contracts ──────────────────
  const analysedContracts = Object.keys(analysisHistory);
  const allAlerts: (RiskAlert & { contractId: string })[] = analysedContracts.flatMap(cid =>
    (analysisHistory[cid].zone_decision.risk_alerts || []).map(a => ({ ...a, contractId: cid }))
  );

  // ── KPI numbers ────────────────────────────────────────────────────────
  const criticalCount  = allAlerts.filter(a => a.severity === 'Critical').length;
  const highCount      = allAlerts.filter(a => a.severity === 'High').length;
  const contractsAffected = new Set(allAlerts.filter(a => a.severity === 'Critical').map(a => a.contractId)).size;

  // ── Per-contract breakdown ─────────────────────────────────────────────
  const perContract = analysedContracts.map(cid => {
    const alerts = allAlerts.filter(a => a.contractId === cid);
    return {
      cid,
      rec: analysisHistory[cid].zone_decision.recommendation,
      critical: alerts.filter(a => a.severity === 'Critical').length,
      high:     alerts.filter(a => a.severity === 'High').length,
      medium:   alerts.filter(a => a.severity === 'Medium').length,
      total:    alerts.length,
    };
  }).sort((a, b) => b.critical - a.critical || b.high - a.high);

  // ── Per-rule breakdown ─────────────────────────────────────────────────
  const ruleMap = new Map<string, { critical: number; high: number; medium: number; total: number }>();
  allAlerts.forEach(a => {
    const r = a.rule_id;
    const cur = ruleMap.get(r) || { critical: 0, high: 0, medium: 0, total: 0 };
    if (a.severity === 'Critical') cur.critical++;
    else if (a.severity === 'High') cur.high++;
    else cur.medium++;
    cur.total++;
    ruleMap.set(r, cur);
  });
  const perRule = [...ruleMap.entries()].sort((a, b) => b[1].critical - a[1].critical || b[1].high - a[1].high);

  // ── Resolved alert IDs (from checklist localStorage per contract) ─────
  // resolvedVersion triggers re-read after user ticks/unticks here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolvedByContract: Record<string, Set<string>> = {};
  analysedContracts.forEach(cid => {
    try {
      const saved = localStorage.getItem(`checklist_resolved_${cid}`);
      resolvedByContract[cid] = saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { resolvedByContract[cid] = new Set(); }
  });
  void resolvedVersion; // ensure re-render when version bumps

  function isAlertResolved(a: RiskAlert & { contractId: string }): boolean {
    const ids = resolvedByContract[a.contractId] ?? new Set();
    return [...ids].some(r =>
      r === a.alert_id || r === a.related_record ||
      (a.related_record && r.includes(a.related_record)) ||
      (a.related_record && a.related_record.includes(r.replace('approve:', '')))
    );
  }

  function toggleAlertResolved(a: RiskAlert & { contractId: string }) {
    const key = `checklist_resolved_${a.contractId}`;
    try {
      const saved = localStorage.getItem(key);
      const ids: string[] = saved ? JSON.parse(saved) : [];
      const resolved = isAlertResolved(a);
      if (resolved) {
        // Remove all IDs related to this alert
        const remove = new Set([a.alert_id, a.related_record].filter(Boolean));
        const next = ids.filter(id => !remove.has(id));
        localStorage.setItem(key, JSON.stringify(next));
      } else {
        // Add alert_id and related_record (both) for maximum matching coverage
        const toAdd = [a.alert_id, a.related_record].filter((x): x is string => !!x && !ids.includes(x));
        localStorage.setItem(key, JSON.stringify([...ids, ...toAdd]));
      }
      setResolvedVersion(v => v + 1);
    } catch {}
  }

  // ── Filtered table — unresolved first ─────────────────────────────────
  const allFiltered = allAlerts
    .filter(a => severityFilter === 'All' || a.severity === severityFilter)
    .filter(a => ruleFilter === 'All' || a.rule_id === ruleFilter)
    .filter(a => contractFilter === 'All' || a.contractId === contractFilter)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const filtered = allFiltered.filter(a => !isAlertResolved(a));
  const resolvedFiltered = allFiltered.filter(a => isAlertResolved(a));

  function goToContract(cid: string) {
    setSelectedContract(cid);
    navigate('/pipeline');
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (analysedContracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldCheck size={48} className="text-slate-200" />
        <div className="text-slate-500 text-base font-medium">Chưa có dữ liệu rủi ro</div>
        <div className="text-slate-400 text-sm text-center max-w-sm">
          Chạy phân tích ít nhất một hợp đồng để xem tổng hợp cảnh báo rủi ro tại đây.
        </div>
        <button
          onClick={() => navigate('/pipeline')}
          className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg mt-2"
        >
          <Play size={14} /> Chạy phân tích ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {activeAlert && (
        <AlertActionModal
          alert={activeAlert}
          contractId={activeAlert.contractId}
          onClose={() => setActiveAlert(null)}
          onGoToPipeline={goToContract}
        />
      )}
      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Tổng cảnh báo"
          value={allAlerts.length}
          sub={`${analysedContracts.length} hợp đồng đã phân tích`}
          icon={ShieldAlert}
          iconColor="text-slate-500"
        />
        <KpiCard
          label="Critical"
          value={criticalCount}
          sub={criticalCount > 0 ? 'Cần xử lý ngay' : 'Không có'}
          icon={ShieldAlert}
          iconColor={criticalCount > 0 ? 'text-red-500' : 'text-green-500'}
          trend={criticalCount > 0 ? 'down' : undefined}
          trendLabel={criticalCount > 0 ? 'Ưu tiên cao nhất' : undefined}
        />
        <KpiCard
          label="High"
          value={highCount}
          sub="Cần theo dõi"
          icon={ShieldAlert}
          iconColor={highCount > 0 ? 'text-amber-500' : 'text-green-500'}
        />
        <KpiCard
          label="HĐ bị ảnh hưởng (Critical)"
          value={contractsAffected}
          sub={contractsAffected > 0 ? `trong ${analysedContracts.length} HĐ đã phân tích` : 'Không có Critical'}
          icon={ShieldAlert}
          iconColor={contractsAffected > 0 ? 'text-red-500' : 'text-green-500'}
        />
      </div>

      {/* ── Two-panel breakdown ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Per-contract panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Phân bổ theo hợp đồng</h2>
            <p className="text-xs text-slate-400 mt-0.5">Click để xem danh sách alerts của từng HĐ</p>
          </div>
          <div className="divide-y divide-slate-100">
            {perContract.map(({ cid, critical, high, medium, total }) => (
              <div key={cid}>
                <button
                  onClick={() => setExpandedContract(expandedContract === cid ? null : cid)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="font-mono font-semibold text-sm text-brand-800 w-16 shrink-0">{cid}</span>
                  <div className="flex gap-1.5 flex-1">
                    {critical > 0 && (
                      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{critical} Critical</span>
                    )}
                    {high > 0 && (
                      <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{high} High</span>
                    )}
                    {medium > 0 && (
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{medium} Medium</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 mr-1">{total} alerts</span>
                  {expandedContract === cid
                    ? <ChevronUp size={14} className="text-slate-400 shrink-0" />
                    : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                </button>
                {expandedContract === cid && (
                  <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 space-y-1.5">
                    {allAlerts
                      .filter(a => a.contractId === cid)
                      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
                      .map(a => (
                        <div key={a.alert_id} className="flex items-start gap-2 text-xs text-slate-600">
                          <StatusBadge value={a.severity} size="sm" className="shrink-0 mt-0.5" />
                          <span className="flex-1">{a.description}</span>
                        </div>
                      ))}
                    <button
                      onClick={() => goToContract(cid)}
                      className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                    >
                      Xử lý tại Pipeline <ArrowRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Per-rule panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Phân bổ theo quy tắc vi phạm</h2>
            <p className="text-xs text-slate-400 mt-0.5">Rule nào đang gây vấn đề nhiều nhất</p>
          </div>
          <div className="divide-y divide-slate-100">
            {perRule.map(([ruleId, counts]) => {
              const maxTotal = Math.max(...perRule.map(([, c]) => c.total), 1);
              const pct = Math.round((counts.total / maxTotal) * 100);
              return (
                <div key={ruleId} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{ruleId}</span>
                      <span className="text-xs text-slate-500">{RULE_LABELS[ruleId] || ruleId}</span>
                    </div>
                    <div className="flex gap-1">
                      {counts.critical > 0 && <span className="text-xs font-semibold text-red-600">{counts.critical}C</span>}
                      {counts.high > 0 && <span className="text-xs font-semibold text-amber-600 ml-1">{counts.high}H</span>}
                      {counts.medium > 0 && <span className="text-xs font-semibold text-blue-600 ml-1">{counts.medium}M</span>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${counts.critical > 0 ? 'bg-red-400' : counts.high > 0 ? 'bg-amber-400' : 'bg-blue-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Full alerts table ──────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800 mr-2">Tất cả cảnh báo</h2>

          {/* Contract filter */}
          <select
            value={contractFilter}
            onChange={e => setContractFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="All">Tất cả HĐ</option>
            {analysedContracts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Severity filter */}
          <div className="flex gap-1.5">
            {(['All', 'Critical', 'High', 'Medium'] as SeverityFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setSeverityFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  severityFilter === f
                    ? f === 'Critical' ? 'bg-red-600 text-white'
                      : f === 'High' ? 'bg-amber-500 text-white'
                      : f === 'Medium' ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Rule filter */}
          <select
            value={ruleFilter}
            onChange={e => setRuleFilter(e.target.value as RuleId)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 ml-auto"
          >
            <option value="All">Tất cả rule</option>
            {perRule.map(([r]) => <option key={r} value={r}>{r} — {RULE_LABELS[r] || r}</option>)}
          </select>

          <span className="text-xs text-slate-400">{filtered.length} chưa xử lý · {resolvedFiltered.length} đã xử lý</span>
        </div>

        {/* Table — unresolved only */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            <ShieldCheck size={28} className="mx-auto text-slate-200 mb-2" />
            {resolvedFiltered.length > 0 ? 'Tất cả cảnh báo đã được xử lý!' : 'Không có cảnh báo phù hợp với bộ lọc'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3">Mức độ</th>
                  <th className="text-left px-4 py-3">HĐ</th>
                  <th className="text-left px-4 py-3">Rule</th>
                  <th className="text-left px-4 py-3">Mô tả</th>
                  <th className="text-left px-4 py-3">Hành động khuyến nghị</th>
                  <th className="text-center px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => (
                  <tr
                    key={`${a.contractId}-${a.alert_id}`}
                    className={`hover:bg-slate-50 ${a.severity === 'Critical' ? 'border-l-4 border-l-red-400' : a.severity === 'High' ? 'border-l-4 border-l-amber-400' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAlertResolved(a)}
                        title="Đánh dấu đã giải quyết"
                        className="w-5 h-5 rounded border-2 border-slate-300 hover:border-green-500 flex items-center justify-center transition-colors"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={a.severity} />
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-xs text-brand-800">{a.contractId}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{a.rule_id}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 text-xs max-w-[260px]">{a.description}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <button onClick={() => setActiveAlert(a)} className="text-left group">
                        <span className="text-xs text-slate-600 line-clamp-2 group-hover:text-brand-700 transition-colors">
                          {(a.recommended_action || fallbackAction(a)).slice(0, 80)}…
                        </span>
                        <span className="flex items-center gap-0.5 text-xs text-brand-600 font-semibold mt-1 group-hover:underline">
                          Xem chi tiết <ArrowRight size={11} />
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => goToContract(a.contractId)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap flex items-center gap-1"
                      >
                        Xử lý <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resolved alerts — collapsible section */}
        {resolvedFiltered.length > 0 && (
          <div className="border-t border-slate-100">
            <button
              onClick={() => setShowResolved(v => !v)}
              className="w-full flex items-center gap-2 px-5 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <ShieldCheck size={14} className="text-green-500" />
              <span>{resolvedFiltered.length} cảnh báo đã giải quyết</span>
              {showResolved ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
            </button>
            {showResolved && (
              <div className="overflow-x-auto bg-green-50/40">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {resolvedFiltered.map(a => (
                      <tr key={`resolved-${a.contractId}-${a.alert_id}`} className="opacity-60 hover:opacity-100 transition-opacity">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => toggleAlertResolved(a)}
                            title="Bỏ đánh dấu đã giải quyết"
                            className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 flex items-center justify-center text-white transition-colors hover:bg-red-400 hover:border-red-400"
                          >
                            <ShieldCheck size={11} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge value={a.severity} /></td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-xs text-brand-800">{a.contractId}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{a.rule_id}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[260px]">{a.description}</td>
                        <td className="px-4 py-2.5 text-xs text-green-700 font-medium">✓ Đã xử lý</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => goToContract(a.contractId)}
                            className="text-xs text-slate-400 hover:text-brand-600 font-medium whitespace-nowrap flex items-center gap-1"
                          >
                            Pipeline <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
