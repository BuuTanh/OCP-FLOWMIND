import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import {
  FileText, DollarSign, AlertTriangle, TrendingUp, AlertCircle,
  CheckCircle, History, ArrowRight, Play,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import type { Contract, Recommendation, CashflowMonth } from '../types';

function formatVnd(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)} triệu`;
  return v.toLocaleString('vi-VN');
}

function formatM(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}tỷ`;
  return `${(v / 1e6).toFixed(0)}M`;
}

const REC_COLORS: Record<string, string> = {
  KY: '#22c55e',
  KY_CO_DIEU_KIEN: '#f59e0b',
  KHONG_KY: '#ef4444',
  CHUA_DU_DU_LIEU: '#94a3b8',
  CHUA_DU_DATA: '#94a3b8',
};

const REC_LABELS: Record<string, string> = {
  KY: 'Ký',
  KY_CO_DIEU_KIEN: 'Ký có ĐK',
  KHONG_KY: 'Không ký',
  CHUA_DU_DU_LIEU: 'Chưa đủ DL',
  CHUA_DU_DATA: 'Chưa đủ DL',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { lastResult, analysisHistory, setSelectedContract, setLastResult, crisisResolved, runLog } = useApp();
  const { getContracts, getCashflow, getReceivables } = useApi();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
  const [receivables, setReceivables] = useState<{ open_vnd: number; pipeline_vnd: number } | null>(null);

  useEffect(() => {
    getContracts()
      .then(data => setContracts(data))
      .catch(() => {})
      .finally(() => setLoadingContracts(false));
  }, []);

  useEffect(() => {
    Promise.all([getCashflow(), getReceivables()])
      .then(([cf, rec]) => { setCashflow(cf); setReceivables(rec); })
      .catch(() => {});
  }, []);

  const totalValue = contracts.reduce((s, c) => s + c.contract_value, 0);
  const historyEntries = Object.entries(analysisHistory);
  const allAlerts = historyEntries.flatMap(([, r]) => r.zone_decision.risk_alerts || []);
  const criticalCount = allAlerts.filter(a => a.severity === 'Critical').length;

  const displayCashflow = lastResult?.zone_input.cashflow_chart?.length
    ? lastResult.zone_input.cashflow_chart
    : cashflow;
  const cashPositionRow = displayCashflow[displayCashflow.length - 1];
  const cashPositionValue = cashPositionRow?.projected_closing_cash;

  const openAR = receivables?.open_vnd ?? lastResult?.zone_input.receivables?.open_vnd ?? 0;
  const avgMargin = contracts.length ? contracts.reduce((s, c) => s + c.gross_margin, 0) / contracts.length : 0;

  // Crisis banner: active only when actual analysis detected crisis AND not resolved
  const crisisActive = lastResult?.zone_workflow.crisis_layer.active && !crisisResolved;
  const hasCrisisData = lastResult != null;

  // Chart tổng hợp: phân bố khuyến nghị trên các hợp đồng đã phân tích
  const decisionData = useMemo(() => {
    const counts: Record<string, number> = {};
    historyEntries.forEach(([, r]) => {
      const rec = r.zone_decision.recommendation;
      counts[rec] = (counts[rec] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      key, value, name: REC_LABELS[key] || key, color: REC_COLORS[key] || '#94a3b8',
    }));
  }, [historyEntries]);
  const totalAnalyzed = historyEntries.length;

  function goToRun(contractId: string) {
    setSelectedContract(contractId);
    const hist = analysisHistory[contractId];
    if (hist) setLastResult(hist);
    navigate('/pipeline');
  }

  return (
    <div className="space-y-6">
      {/* Crisis Banner */}
      {hasCrisisData && (crisisActive ? (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-red-700 text-sm">⚠ Crisis Layer: Giao dịch đáng ngờ phát hiện</div>
            <div className="text-red-600 text-xs mt-0.5">
              {lastResult?.zone_workflow.crisis_layer.alert
                ? 'Có giao dịch rủi ro cao cần Founder xác nhận trước khi phân tích tiếp.'
                : 'Cần kiểm tra trạng thái giao dịch ngân hàng.'}
            </div>
          </div>
          <button
            onClick={() => navigate('/pipeline')}
            className="ml-auto text-xs text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 font-medium shrink-0"
          >
            Xem chi tiết
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3">
          <CheckCircle size={16} className="text-green-500 shrink-0" />
          <div className="text-green-700 text-sm font-medium">Crisis Layer: Không có rủi ro giao dịch nghiêm trọng.</div>
        </div>
      ))}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Tổng hợp đồng"
          value={loadingContracts ? '…' : String(contracts.length)}
          sub="đang theo dõi"
          icon={FileText}
          iconColor="text-brand-600"
          trend="neutral"
          trendLabel="Từ Google Sheets"
        />
        <KpiCard
          label="Tổng giá trị"
          value={loadingContracts ? '…' : formatVnd(totalValue)}
          sub={`${contracts.length} hợp đồng`}
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KpiCard
          label="Cash position"
          value={cashPositionValue != null ? formatVnd(cashPositionValue) : '—'}
          sub={cashPositionRow ? `${cashPositionRow.month} · ${cashPositionRow.status === 'CRITICAL' ? '⚠ Nguy hiểm' : cashPositionRow.status === 'WARNING' ? '⚠ Cảnh báo' : '✓ Ổn định'}` : 'Đang tải…'}
          icon={TrendingUp}
          iconColor={cashPositionRow?.status === 'CRITICAL' ? 'text-red-500' : cashPositionRow?.status === 'WARNING' ? 'text-amber-500' : 'text-blue-600'}
        />
        <KpiCard
          label="Cảnh báo rủi ro"
          value={allAlerts.length > 0 ? (criticalCount > 0 ? criticalCount : allAlerts.length) : '—'}
          sub={allAlerts.length > 0 ? (criticalCount > 0 ? `${criticalCount} Critical` : `${allAlerts.length} alerts`) : 'Chưa phân tích'}
          icon={AlertCircle}
          iconColor={criticalCount > 0 ? 'text-red-500' : 'text-slate-400'}
          trend={criticalCount > 0 ? 'down' : undefined}
          trendLabel={criticalCount > 0 ? 'Cần xử lý ngay' : undefined}
        />
      </div>

      {/* Chart tổng hợp + Sức khỏe tài chính */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Tổng hợp kết quả phân tích */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm">Tổng hợp kết quả phân tích</h2>
            <span className="text-xs text-slate-400">{totalAnalyzed} hợp đồng đã phân tích</span>
          </div>
          {totalAnalyzed === 0 ? (
            <div className="text-sm text-slate-400 text-center py-10">Chưa có phân tích nào — chạy phân tích AI để xem tổng hợp</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-36 h-36 shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                      {decisionData.map(d => <Cell key={d.key} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} hợp đồng`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-800">{totalAnalyzed}</span>
                  <span className="text-[10px] text-slate-400">đã phân tích</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {decisionData.map(d => (
                  <div key={d.key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sức khỏe tài chính */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm">Sức khỏe tài chính</h2>
            <button onClick={() => navigate('/financial')} className="text-xs text-brand-600 hover:underline font-medium">Chi tiết →</button>
          </div>
          {displayCashflow.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-10">Đang tải dữ liệu…</div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 text-xs">
                <span className={`inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-full ${
                  cashPositionRow?.status === 'CRITICAL' ? 'bg-red-100 text-red-700'
                  : cashPositionRow?.status === 'WARNING' ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
                }`}>
                  {cashPositionRow?.status === 'CRITICAL' ? '⚠ Nguy hiểm' : cashPositionRow?.status === 'WARNING' ? '⚠ Cảnh báo' : '✓ Ổn định'}
                </span>
                <span className="text-slate-400">{cashPositionRow?.month} · {formatM(cashPositionValue ?? 0)}</span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={displayCashflow.slice(-6)} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={v => formatM(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={550_000_000} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="projected_closing_cash" stroke="#3b82f6" fill="url(#cashGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-slate-400">Công nợ mở (AR)</div>
                  <div className="font-semibold text-slate-700">{formatM(openAR)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Margin TB danh mục</div>
                  <div className={`font-semibold ${avgMargin >= 0.28 ? 'text-green-600' : 'text-amber-600'}`}>{(avgMargin * 100).toFixed(1)}%</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lịch sử phân tích */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <History size={15} className="text-slate-400" /> Phân tích gần đây
          </h2>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/pipeline')} className="text-xs text-slate-500 hover:text-brand-700 font-medium flex items-center gap-1">
              <Play size={12} /> Phân tích mới
            </button>
            <button onClick={() => navigate('/pipeline')} className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1">
              Xem toàn bộ lịch sử <ArrowRight size={12} />
            </button>
          </div>
        </div>
        {runLog.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Chưa có phân tích nào</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {runLog.slice(0, 6).map(entry => (
              <div
                key={entry.id}
                onClick={() => goToRun(entry.contractId)}
                className="flex items-center justify-between py-2.5 px-2 -mx-2 text-sm rounded-lg cursor-pointer hover:bg-slate-50"
              >
                <div>
                  <span className="font-medium text-slate-700">{entry.contractId}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {new Date(entry.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <StatusBadge value={entry.recommendation as Recommendation} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
