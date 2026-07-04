import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { TrendingDown, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { KpiCard } from '../components/KpiCard';
import type { CashflowMonth } from '../types';

function formatM(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}tỷ`;
  return `${(v / 1e6).toFixed(0)}M`;
}

function barColor(status: string) {
  if (status === 'CRITICAL') return '#ef4444';
  if (status === 'WARNING') return '#f59e0b';
  return '#22c55e';
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { payload: CashflowMonth }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
      <div className="font-semibold text-slate-800 mb-1.5">{label}</div>
      <div className="text-green-600">Thu dự kiến: {formatM(d.expected_cash_in)}</div>
      <div className="text-red-500">Chi dự kiến: {formatM(d.expected_cash_out)}</div>
      <div className={`font-semibold border-t border-slate-100 pt-1 mt-1 ${d.projected_closing_cash < 550_000_000 ? 'text-red-600' : 'text-slate-800'}`}>
        Closing Cash: {formatM(d.projected_closing_cash)}
        {d.projected_closing_cash < 550_000_000 && (
          <span className="text-red-400 font-normal ml-1">
            (thiếu {formatM(550_000_000 - d.projected_closing_cash)} so với ngưỡng)
          </span>
        )}
      </div>
    </div>
  );
};

export function Financial() {
  const { lastResult } = useApp();
  const { getCashflow } = useApi();

  const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCashflow() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCashflow();
      setCashflow(data);
    } catch (e) {
      setError('Không thể tải dữ liệu cashflow — đảm bảo backend đang chạy');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCashflow(); }, []);

  // Nếu đã có kết quả phân tích, ưu tiên dùng cashflow từ pipeline (đã qua normalize)
  const displayCashflow = lastResult?.zone_input.cashflow_chart?.length
    ? lastResult.zone_input.cashflow_chart
    : cashflow;

  const receivables = lastResult?.zone_input.receivables;
  const openReceivables = receivables?.open_vnd ?? 0;
  const pipelineReceivables = receivables?.pipeline_vnd ?? 0;
  const criticalMonths = displayCashflow.filter(c => c.status === 'CRITICAL').length;
  const warningMonths = displayCashflow.filter(c => c.status === 'WARNING').length;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Tháng CRITICAL (< 0)"
          value={criticalMonths}
          sub={`${warningMonths} tháng WARNING — ${displayCashflow.length} tháng theo dõi`}
          icon={AlertCircle}
          iconColor={criticalMonths > 0 ? 'text-red-500' : 'text-green-500'}
        />
        <KpiCard
          label="Công nợ mở (Open AR)"
          value={openReceivables ? formatM(openReceivables) : '—'}
          sub={openReceivables ? 'Chưa thu được' : 'Chạy phân tích để cập nhật'}
          icon={TrendingDown}
          iconColor="text-red-500"
        />
        <KpiCard
          label="Pipeline chưa xuất HĐ"
          value={pipelineReceivables ? formatM(pipelineReceivables) : '—'}
          sub={pipelineReceivables ? 'Đơn hàng pending' : 'Chạy phân tích để cập nhật'}
          icon={TrendingUp}
          iconColor="text-amber-500"
        />
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-brand-600" />
          Đang tải dữ liệu từ Google Sheets…
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadCashflow} className="text-xs border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 font-medium">
            Thử lại
          </button>
        </div>
      )}

      {/* Cashflow Chart */}
      {!loading && displayCashflow.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Dòng tiền dự báo theo tháng</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nguồn: Google Sheets OPC_FinancialData · Ngưỡng tối thiểu: 550M VND
                {lastResult && <span className="ml-2 text-brand-600">· Dữ liệu từ lần phân tích gần nhất</span>}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block" />OK (≥550M)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />Warning</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Critical (&lt;0)</span>
              <button onClick={loadCashflow} className="flex items-center gap-1 text-brand-600 hover:text-brand-800 ml-2">
                <RefreshCw size={12} />Reload
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={displayCashflow} margin={{ top: 5, right: 10, bottom: 5, left: 20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v / 1e6}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
              <ReferenceLine y={550_000_000} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: '550M min', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
              <Bar dataKey="projected_closing_cash" radius={[4, 4, 0, 0]} maxBarSize={52}>
                {displayCashflow.map((entry, index) => (
                  <Cell key={index} fill={barColor(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly table */}
      {!loading && displayCashflow.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Chi tiết theo tháng</h2>
            <span className="text-xs text-slate-400">{displayCashflow.length} tháng · Ngưỡng min 550M VND</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 font-semibold border-b border-slate-100">
                <th className="text-left px-5 py-3">Tháng</th>
                <th className="text-right px-5 py-3">Dự kiến thu</th>
                <th className="text-right px-5 py-3">Dự kiến chi</th>
                <th className="text-right px-5 py-3">Net Flow</th>
                <th className="text-right px-5 py-3">Closing Cash</th>
                <th className="text-right px-5 py-3">vs 550M min</th>
                <th className="text-center px-5 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayCashflow.map((row, i) => {
                const net = row.expected_cash_in - row.expected_cash_out;
                const vs550 = row.projected_closing_cash - 550_000_000;
                return (
                  <tr key={i} className={`hover:bg-slate-50 ${row.status === 'CRITICAL' ? 'bg-red-50/40' : row.status === 'WARNING' ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-5 py-3 font-medium text-slate-700">{row.month}</td>
                    <td className="px-5 py-3 text-right text-green-700">{formatM(row.expected_cash_in)}</td>
                    <td className="px-5 py-3 text-right text-red-500">{formatM(row.expected_cash_out)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {net >= 0 ? '+' : ''}{formatM(net)}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${row.projected_closing_cash < 0 ? 'text-red-700' : row.projected_closing_cash < 550_000_000 ? 'text-amber-700' : 'text-slate-800'}`}>
                      {formatM(row.projected_closing_cash)}
                    </td>
                    <td className={`px-5 py-3 text-right text-xs font-medium ${vs550 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {vs550 >= 0 ? '+' : ''}{formatM(vs550)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.status === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                        row.status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
