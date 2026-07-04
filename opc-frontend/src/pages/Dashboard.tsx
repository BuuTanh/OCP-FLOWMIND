import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, DollarSign, AlertTriangle, TrendingUp, Play, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import type { Contract, Recommendation } from '../types';

function formatVnd(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} triệu`;
  return v.toLocaleString('vi-VN');
}

function MarginDot({ m }: { m: number }) {
  const color = m >= 0.28 ? 'bg-green-500' : m >= 0.24 ? 'bg-amber-400' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1.5`} />;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { lastResult, analysisHistory, setSelectedContract, setLastResult, crisisResolved, runLog } = useApp();
  const { getContracts } = useApi();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);

  useEffect(() => {
    getContracts()
      .then(data => setContracts(data))
      .catch(() => {})
      .finally(() => setLoadingContracts(false));
  }, []);

  const totalValue = contracts.reduce((s, c) => s + c.contract_value, 0);
  const historyEntries = Object.entries(analysisHistory);
  const allAlerts = historyEntries.flatMap(([, r]) => r.zone_decision.risk_alerts || []);
  const criticalCount = allAlerts.filter(a => a.severity === 'Critical').length;
  const cashPosition = lastResult?.zone_input.cashflow_chart[0]?.projected_closing_cash;

  // Crisis banner: active only when actual analysis detected crisis AND not resolved
  const crisisActive = lastResult?.zone_workflow.crisis_layer.active && !crisisResolved;
  const hasCrisisData = lastResult != null;

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
          value={cashPosition != null ? formatVnd(cashPosition) : '—'}
          sub={cashPosition != null ? 'tháng gần nhất (phân tích)' : 'Chưa phân tích'}
          icon={TrendingUp}
          iconColor="text-blue-600"
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

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Contract list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 text-sm">Danh sách hợp đồng</h2>
            <div className="flex items-center gap-3">
              {loadingContracts && <RefreshCw size={13} className="animate-spin text-slate-400" />}
              <button onClick={() => navigate('/contracts')} className="text-xs text-brand-600 hover:underline font-medium">Xem tất cả →</button>
            </div>
          </div>
          {contracts.length === 0 && !loadingContracts ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Không tải được dữ liệu — đảm bảo backend đang chạy</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 font-medium">
                  <th className="text-left px-5 py-3">Hợp đồng</th>
                  <th className="text-right px-5 py-3">Giá trị</th>
                  <th className="text-right px-5 py-3">Margin</th>
                  <th className="text-center px-5 py-3">Kết quả phân tích</th>
                  <th className="text-center px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map(c => {
                  const result = analysisHistory[c.contract_id];
                  const rec = result?.zone_decision.recommendation as Recommendation | undefined;
                  return (
                    <tr
                      key={c.contract_id}
                      className="hover:bg-slate-50 text-sm cursor-pointer"
                      onClick={() => {
                        setSelectedContract(c.contract_id);
                        const hist = analysisHistory[c.contract_id];
                        if (hist) setLastResult(hist);
                        navigate('/pipeline');
                      }}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-800">{c.contract_id}</div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{c.description}</div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700 font-medium">{formatVnd(c.contract_value)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="flex items-center justify-end">
                          <MarginDot m={c.gross_margin} />
                          <span className={`font-medium ${c.gross_margin >= 0.28 ? 'text-green-600' : c.gross_margin >= 0.24 ? 'text-amber-600' : 'text-red-600'}`}>
                            {(c.gross_margin * 100).toFixed(0)}%
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {rec ? <StatusBadge value={rec} /> : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedContract(c.contract_id); setLastResult(null); navigate('/pipeline'); }}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Phân tích
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Thao tác nhanh</h2>
            <button
              onClick={() => navigate('/pipeline')}
              className="w-full flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
            >
              <Play size={15} /> Chạy phân tích AI
            </button>
            <button
              onClick={() => navigate('/risks')}
              className="mt-2 w-full text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Xem cảnh báo rủi ro
            </button>
          </div>

          {/* Recent runs from runLog */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-sm mb-3">Phân tích gần đây</h2>
            {runLog.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-6">Chưa có phân tích nào</div>
            ) : (
              <div className="space-y-2">
                {runLog.slice(0, 6).map(entry => (
                  <div key={entry.id} className="flex items-center justify-between py-1.5 text-sm">
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
      </div>
    </div>
  );
}
