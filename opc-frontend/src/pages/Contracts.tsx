import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileText, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { StatusBadge } from '../components/StatusBadge';
import type { Contract, Recommendation } from '../types';

const DECISION_BADGE: Record<string, { label: string; cls: string }> = {
  KY:             { label: '✅ Đã ký', cls: 'bg-green-100 text-green-700' },
  TU_CHOI:        { label: '❌ Từ chối', cls: 'bg-red-100 text-red-700' },
  YEU_CAU_BO_SUNG:{ label: '📋 Chờ bổ sung', cls: 'bg-blue-100 text-blue-700' },
};

function formatVnd(v: number) {
  return (v / 1e9).toFixed(2) + ' tỷ';
}

function MarginBadge({ m }: { m: number }) {
  const cls = m >= 0.28 ? 'text-green-700 bg-green-50' : m >= 0.24 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {(m * 100).toFixed(0)}%
    </span>
  );
}

export function Contracts() {
  const navigate = useNavigate();
  const { setSelectedContract, analysisHistory, contractDecisions } = useApp();
  const { getContracts } = useApi();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setContracts(await getContracts());
    } catch {
      setError('Không tải được dữ liệu — đảm bảo backend đang chạy tại localhost:8000');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Dynamic summary counts from actual data
  const aboveTarget = contracts.filter(c => c.gross_margin >= 0.28).length;
  const midRange    = contracts.filter(c => c.gross_margin >= 0.24 && c.gross_margin < 0.28).length;
  const belowRange  = contracts.filter(c => c.gross_margin < 0.24).length;

  function handleAnalyze(id: string) {
    setSelectedContract(id);
    navigate('/pipeline');
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Danh sách Hợp đồng</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Đang tải…' : `${contracts.length} hợp đồng đang theo dõi`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <FileText size={15} />
            <span>Nguồn: Google Sheets OPC_CoreData</span>
          </div>
          <button onClick={load} className="text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50">
            Reload
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="text-xs border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 font-medium">Thử lại</button>
        </div>
      )}

      {/* Summary cards — from real data */}
      {!loading && contracts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{aboveTarget}</div>
            <div className="text-xs text-green-600 mt-1 font-medium">Margin ≥ 28%</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{midRange}</div>
            <div className="text-xs text-amber-600 mt-1 font-medium">Margin 24–27%</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-700">{belowRange}</div>
            <div className="text-xs text-red-600 mt-1 font-medium">Margin &lt; 24%</div>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && contracts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <th className="text-left px-6 py-3.5">Hợp đồng</th>
                <th className="text-left px-6 py-3.5">Mô tả</th>
                <th className="text-right px-6 py-3.5">Giá trị</th>
                <th className="text-center px-6 py-3.5">Margin</th>
                <th className="text-center px-6 py-3.5">Trạng thái</th>
                <th className="text-center px-6 py-3.5">Kết quả AI</th>
                <th className="text-center px-6 py-3.5">Quyết định</th>
                <th className="text-center px-6 py-3.5">Kỳ hạn</th>
                <th className="text-center px-6 py-3.5">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map(c => {
                const result = analysisHistory[c.contract_id];
                const rec = result?.zone_decision.recommendation as Recommendation | undefined;
                const decisionBadge = contractDecisions[c.contract_id]
                  ? DECISION_BADGE[contractDecisions[c.contract_id].action]
                  : null;
                const endDate = new Date(c.end_date);
                const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);

                return (
                  <tr key={c.contract_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-brand-800 text-sm">{c.contract_id}</div>
                      <div className="text-xs text-slate-400">{c.customer_id}</div>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      <div className="text-sm text-slate-700 truncate">{c.description}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-800">{formatVnd(c.contract_value)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <MarginBadge m={c.gross_margin} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {rec ? <StatusBadge value={rec} /> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {decisionBadge
                        ? <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-lg ${decisionBadge.cls}`}>{decisionBadge.label}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-medium ${daysLeft < 60 ? 'text-red-600' : daysLeft < 120 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {daysLeft > 0 ? `${daysLeft} ngày` : 'Hết hạn'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleAnalyze(c.contract_id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-800 hover:bg-brand-900 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Play size={12} /> Phân tích ngay
                      </button>
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
