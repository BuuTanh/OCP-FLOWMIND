import { useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Loader2, Search, TrendingUp } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { ResearchReport, ResearchResult, Sentiment } from '../types';

const sentimentStyle: Record<Sentiment, string> = {
  'TÍCH CỰC': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'TRUNG LẬP': 'bg-amber-100 text-amber-700 border-amber-200',
  'TIÊU CỰC': 'bg-red-100 text-red-700 border-red-200',
  'CHƯA ĐỦ DỮ LIỆU': 'bg-slate-100 text-slate-700 border-slate-200',
};

function ReportCard({ report, icon: Icon }: { report: ResearchReport; icon: typeof Building2 }) {
  return <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
    <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3"><div className="p-2.5 rounded-lg bg-blue-50 text-blue-700"><Icon size={20} /></div><div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{report.agent}</p>
        <h2 className="font-semibold text-slate-800 mt-0.5">{report.subject}</h2>
        <p className="text-xs text-slate-500 mt-1">{report.report_id} · Tin cậy {report.confidence}%</p>
      </div></div>
      <span className={`border rounded-full px-3 py-1 text-xs font-bold ${sentimentStyle[report.sentiment]}`}>{report.sentiment} ({report.sentiment_score > 0 ? '+' : ''}{report.sentiment_score})</span>
    </div>
    <div className="p-5 space-y-5">
      <p className="text-sm leading-6 text-slate-700">{report.executive_summary}</p>
      {report.identity_status && <p className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-3 py-2">Tình trạng định danh: {report.identity_status}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-emerald-50 p-4"><h3 className="text-xs font-bold text-emerald-700 uppercase mb-2">Tín hiệu tích cực</h3>{report.positive_signals.map(item => <p key={item} className="text-sm text-slate-700 mb-1.5 flex gap-2"><CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />{item}</p>)}</div>
        <div className="rounded-lg bg-red-50 p-4"><h3 className="text-xs font-bold text-red-700 uppercase mb-2">Tín hiệu rủi ro</h3>{report.negative_signals.map(item => <p key={item} className="text-sm text-slate-700 mb-1.5 flex gap-2"><AlertTriangle size={15} className="text-red-600 mt-0.5 shrink-0" />{item}</p>)}</div>
      </div>
      <div><h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Nguồn công khai đã tra cứu và tổng hợp</h3><div className="space-y-2">{report.sources.map(source =>
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
          <div className="flex justify-between gap-3"><span className="text-sm font-medium text-slate-800">{source.title}</span><ExternalLink size={14} className="text-slate-400 shrink-0" /></div>
          <p className="text-xs text-slate-400 mt-0.5">{source.publisher} · {source.published_at}</p><p className="text-xs text-slate-600 mt-1">{source.snippet}</p>
        </a>)}</div></div>
      <div><h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Đề xuất thẩm định</h3><ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1">{report.recommended_actions.map(item => <li key={item}>{item}</li>)}</ol></div>
    </div>
  </section>;
}

export function Research() {
  const { runResearch } = useApi();
  const [company, setCompany] = useState('Công ty Kim Cương An Phát');
  const [industry, setIndustry] = useState('Kim cương và trang sức');
  const [province, setProvince] = useState('Hà Nội');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!company.trim() || !industry.trim()) return;
    setLoading(true); setError('');
    try { setResult(await runResearch(company.trim(), industry.trim(), province.trim())); }
    catch { setError('Không thực hiện được tra cứu. Vui lòng kiểm tra máy chủ và thử lại.'); }
    finally { setLoading(false); }
  }

  return <div className="max-w-6xl mx-auto space-y-5">
    <div><div className="flex items-center gap-2"><h1 className="text-xl font-bold text-slate-800">Thẩm định thông tin doanh nghiệp và thị trường</h1><span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded px-2 py-1">NGUỒN CÔNG KHAI</span></div><p className="text-sm text-slate-500 mt-1">Tra cứu thông tin phi tài chính để hỗ trợ đánh giá điều kiện ký kết và kiểm soát rủi ro hợp đồng.</p></div>
    <form onSubmit={submit} className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
      <div className="grid md:grid-cols-[1fr_1fr_0.7fr_auto] gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">Công ty cần thẩm định<input value={company} onChange={e => setCompany(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200" /></label>
        <label className="text-xs font-semibold text-slate-600">Thị trường / ngành<input value={industry} onChange={e => setIndustry(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200" /></label>
        <label className="text-xs font-semibold text-slate-600">Tỉnh, thành phố<input value={province} onChange={e => setProvince(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200" /></label>
        <button disabled={loading} className="h-[42px] rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-5 text-sm font-semibold flex items-center justify-center gap-2">{loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Tra cứu</button>
      </div>
      <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 mt-4">Hệ thống tra cứu Google News theo thời gian thực. Kết quả chỉ được sử dụng khi xác minh đúng pháp nhân và không thay thế quyết định của cấp có thẩm quyền.</p>
    </form>
    {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
    {result && <><div className="bg-slate-900 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs text-slate-400 uppercase">Kết luận tổng hợp</p><p className="font-semibold mt-1">{result.overall.decision_support} · bắt buộc có người phê duyệt</p></div><span className={`border rounded-full px-4 py-1.5 text-sm font-bold ${sentimentStyle[result.overall.sentiment]}`}>{result.overall.sentiment} ({result.overall.sentiment_score})</span></div><div className="grid xl:grid-cols-2 gap-5"><ReportCard report={result.company_report} icon={Building2} /><ReportCard report={result.market_report} icon={TrendingUp} /></div></>}
  </div>;
}
