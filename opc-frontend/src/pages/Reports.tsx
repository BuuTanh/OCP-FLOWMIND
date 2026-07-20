import { useEffect, useMemo, useState } from 'react';
import { FileText, Users, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { Contract, Customer, CashflowMonth } from '../types';

type TabId = 'contracts' | 'customers' | 'financial';

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'contracts', label: 'Hợp đồng', icon: FileText },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'financial', label: 'Tài chính', icon: FileSpreadsheet },
];

function formatVnd(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)} triệu`;
  return v.toLocaleString('vi-VN');
}

function formatM(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}tỷ`;
  return `${(v / 1e6).toFixed(0)}M`;
}

function MarginBadge({ m }: { m: number }) {
  const cls = m >= 0.28 ? 'text-green-700 bg-green-50' : m >= 0.24 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{(m * 100).toFixed(0)}%</span>;
}

function CashStatusBadge({ status }: { status: string }) {
  const cls = status === 'CRITICAL' ? 'bg-red-100 text-red-700' : status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

export function Reports() {
  const { getContracts, getCustomers, getCashflow, getReceivables } = useApi();

  const [activeTab, setActiveTab] = useState<TabId>('contracts');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
  const [receivables, setReceivables] = useState<{ open_vnd: number; pipeline_vnd: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [c, cu, cf, rec] = await Promise.all([getContracts(), getCustomers(), getCashflow(), getReceivables()]);
      setContracts(c); setCustomers(cu); setCashflow(cf); setReceivables(rec);
    } catch {
      setError('Không tải được dữ liệu — đảm bảo backend đang chạy tại localhost:8000');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach(c => { m[c.customer_id] = c.customer_name; });
    return m;
  }, [customers]);

  const totalValue = contracts.reduce((s, c) => s + c.contract_value, 0);
  const totalRevenue = cashflow.reduce((s, m) => s + m.expected_cash_in, 0);

  const tabMeta: Record<TabId, { title: string; summary: string }> = {
    contracts: { title: 'Danh sách hợp đồng', summary: `${contracts.length} hợp đồng · Tổng giá trị ${formatVnd(totalValue)}` },
    customers: { title: 'Danh sách khách hàng', summary: `${customers.length} khách hàng` },
    financial: {
      title: 'Báo cáo tài chính',
      summary: `${cashflow.length} tháng · Doanh thu dự kiến ${formatVnd(totalRevenue)} · Công nợ mở ${formatVnd(receivables?.open_vnd ?? 0)}`,
    },
  };

  return (
    <div className="space-y-5">
      {/* Header — screen only */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Báo cáo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Danh sách hợp đồng, khách hàng và tài chính — xuất PDF theo yêu cầu</p>
        </div>
        {loading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
      </div>

      {/* Tabs — screen only */}
      <div className="flex items-center gap-2 print:hidden">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-brand-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="print:hidden bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="text-xs border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 font-medium">Thử lại</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Card header: title + summary + Reload + Xuất PDF */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 print:hidden">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">{tabMeta[activeTab].title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{tabMeta[activeTab].summary}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} className="text-xs text-slate-500 hover:text-brand-700 font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                Reload
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-800 hover:bg-brand-900 px-3.5 py-1.5 rounded-lg transition-colors"
              >
                <Printer size={13} /> Xuất PDF
              </button>
            </div>
          </div>

          {/* Print-only header */}
          <div className="hidden print:block px-5 pt-5">
            <div className="text-lg font-bold text-slate-900">OPC FlowMind — {tabMeta[activeTab].title}</div>
            <div className="text-xs text-slate-500 mt-1">{tabMeta[activeTab].summary}</div>
            <div className="text-xs text-slate-400 mt-0.5">Xuất lúc: {new Date().toLocaleString('vi-VN')}</div>
          </div>

          {/* ── Hợp đồng ────────────────────────────────────────────────────── */}
          {activeTab === 'contracts' && (
            contracts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Không có hợp đồng nào</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide print:bg-white">
                      <th className="text-left px-5 py-3">Mã HĐ</th>
                      <th className="text-left px-5 py-3">Khách hàng</th>
                      <th className="text-left px-5 py-3">Mô tả</th>
                      <th className="text-right px-5 py-3">Giá trị</th>
                      <th className="text-center px-5 py-3">Tỷ trọng</th>
                      <th className="text-center px-5 py-3">Margin</th>
                      <th className="text-center px-5 py-3">Trạng thái</th>
                      <th className="text-center px-5 py-3">Bắt đầu</th>
                      <th className="text-center px-5 py-3">Kết thúc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contracts.map(c => (
                      <tr key={c.contract_id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-brand-800 text-sm">{c.contract_id}</div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">{customerMap[c.customer_id] || c.customer_id}</td>
                        <td className="px-5 py-3 text-sm text-slate-600 max-w-[220px] truncate">{c.description}</td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-slate-800">{formatVnd(c.contract_value)}</td>
                        <td className="px-5 py-3 text-center text-sm">
                          <span className={c.concentration_pct >= 40 ? 'text-red-600 font-semibold' : 'text-slate-600'}>{c.concentration_pct.toFixed(1)}%</span>
                        </td>
                        <td className="px-5 py-3 text-center"><MarginBadge m={c.gross_margin} /></td>
                        <td className="px-5 py-3 text-center text-xs font-medium text-slate-600">{c.status}</td>
                        <td className="px-5 py-3 text-center text-xs text-slate-500">{c.start_date}</td>
                        <td className="px-5 py-3 text-center text-xs text-slate-500">{c.end_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Khách hàng ──────────────────────────────────────────────────── */}
          {activeTab === 'customers' && (
            customers.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Không có khách hàng nào</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide print:bg-white">
                      <th className="text-left px-5 py-3">Mã KH</th>
                      <th className="text-left px-5 py-3">Tên khách hàng</th>
                      <th className="text-center px-5 py-3">Số hợp đồng</th>
                      <th className="text-right px-5 py-3">Tổng giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map(cu => {
                      const own = contracts.filter(c => c.customer_id === cu.customer_id);
                      const value = own.reduce((s, c) => s + c.contract_value, 0);
                      return (
                        <tr key={cu.customer_id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                          <td className="px-5 py-3 font-semibold text-brand-800 text-sm">{cu.customer_id}</td>
                          <td className="px-5 py-3 text-sm text-slate-700">{cu.customer_name}</td>
                          <td className="px-5 py-3 text-center text-sm text-slate-600">{own.length}</td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-800">{formatVnd(value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Tài chính ───────────────────────────────────────────────────── */}
          {activeTab === 'financial' && (
            cashflow.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Không có dữ liệu dòng tiền</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide print:bg-white">
                      <th className="text-left px-5 py-3">Tháng</th>
                      <th className="text-right px-5 py-3">Thu dự kiến</th>
                      <th className="text-right px-5 py-3">Chi dự kiến</th>
                      <th className="text-right px-5 py-3">Dòng tiền thuần</th>
                      <th className="text-right px-5 py-3">Tiền cuối kỳ</th>
                      <th className="text-center px-5 py-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashflow.map((row, i) => {
                      const net = row.expected_cash_in - row.expected_cash_out;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                          <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{row.month}</td>
                          <td className="px-5 py-3 text-right text-sm text-green-700">{formatM(row.expected_cash_in)}</td>
                          <td className="px-5 py-3 text-right text-sm text-red-500">{formatM(row.expected_cash_out)}</td>
                          <td className={`px-5 py-3 text-right text-sm font-medium ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{net >= 0 ? '+' : ''}{formatM(net)}</td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-800">{formatM(row.projected_closing_cash)}</td>
                          <td className="px-5 py-3 text-center"><CashStatusBadge status={row.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-4 print:border-t-2 print:border-slate-800 print:pt-3">
                  <span>Công nợ phải thu chưa thanh toán: <b className="text-slate-700">{formatVnd(receivables?.open_vnd ?? 0)}</b></span>
                  <span>Giá trị dự kiến chưa xuất hóa đơn: <b className="text-slate-700">{formatVnd(receivables?.pipeline_vnd ?? 0)}</b></span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
