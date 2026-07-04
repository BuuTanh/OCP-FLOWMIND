import { useState, useEffect } from 'react';
import { Save, Plus, X, TestTube, Brain, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:8000';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

export function Settings() {
  const [sheetId, setSheetId] = useState(localStorage.getItem('gsheet_id') || '16991q6bJPKLRt8_8aI29m7CTfpepHqQF');
  const [apiKey] = useState(localStorage.getItem('openai_key') || '');
  const [emails, setEmails] = useState<string[]>(['tanhtlb23411@st.uel.edu.vn']);
  const [newEmail, setNewEmail] = useState('');
  const [schedule, setSchedule] = useState(localStorage.getItem('schedule') || 'off');
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [memoryStats, setMemoryStats] = useState<{ enabled: boolean; count: number } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/memory/stats`).then(r => setMemoryStats(r.data)).catch(() => {});
  }, []);

  function save() {
    localStorage.setItem('gsheet_id', sheetId);
    localStorage.setItem('openai_key', apiKey);
    localStorage.setItem('schedule', schedule);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addEmail() {
    if (newEmail && !emails.includes(newEmail)) {
      setEmails(e => [...e, newEmail]);
      setNewEmail('');
    }
  }

  async function testConnection() {
    setTestStatus('testing');
    try {
      await axios.get(`${API_BASE}/health`, { timeout: 5000 });
      setTestStatus('ok');
    } catch {
      setTestStatus('fail');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  }

  async function clearCache() {
    setClearing(true);
    try {
      await axios.post(`${API_BASE}/memory/invalidate`);
      const stats = await axios.get(`${API_BASE}/memory/stats`);
      setMemoryStats(stats.data);
    } catch {/* offline */}
    setClearing(false);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Data source */}
      <Section title="Nguồn dữ liệu">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Google Sheets ID</label>
          <input
            type="text"
            value={sheetId}
            onChange={e => setSheetId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">Lấy từ URL Google Sheets: docs.google.com/spreadsheets/d/<strong>ID</strong>/edit</p>
        </div>

        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <span className="text-green-500 text-base">✓</span>
          <div>
            <div className="text-sm font-medium text-green-800">OpenAI API Key đã cấu hình</div>
            <div className="text-xs text-green-600 mt-0.5">Được đọc từ file <code className="font-mono bg-green-100 px-1 rounded">.env</code> trong backend — không cần nhập lại</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={testConnection}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 font-medium"
          >
            <TestTube size={15} className={testStatus === 'testing' ? 'animate-pulse text-brand-600' : ''} />
            {testStatus === 'testing' ? 'Đang kiểm tra…' : testStatus === 'ok' ? '✅ Kết nối OK' : testStatus === 'fail' ? '❌ Lỗi kết nối' : 'Kiểm tra kết nối'}
          </button>
        </div>
      </Section>

      {/* Email notifications */}
      <Section title="Thông báo Email">
        <div className="space-y-2">
          {emails.map(email => (
            <div key={email} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="flex-1 font-mono text-xs">{email}</span>
              <button onClick={() => setEmails(e => e.filter(x => x !== email))} className="text-slate-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              placeholder="them@example.com"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <button onClick={addEmail} className="p-2 bg-brand-800 text-white rounded-lg hover:bg-brand-900">
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 mb-1">Loại thông báo</div>
          {['Crisis alerts (ngay lập tức)', 'Báo cáo phân tích (sau mỗi lần chạy)', 'Tóm tắt hàng ngày'].map(type => (
            <label key={type} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-brand-700 w-4 h-4" />
              {type}
            </label>
          ))}
        </div>
      </Section>

      {/* Automation */}
      <Section title="Tự động hóa">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lịch chạy phân tích tự động</label>
          <select
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <option value="off">Tắt (thủ công)</option>
            <option value="30min">Mỗi 30 phút</option>
            <option value="1h">Mỗi 1 giờ</option>
            <option value="8am">8:00 sáng hàng ngày</option>
          </select>
        </div>
      </Section>

      {/* RAG Memory */}
      <Section title="Agentic RAG Memory">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Brain size={20} className="text-brand-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {memoryStats === null ? 'Đang kết nối…' : memoryStats.enabled ? `${memoryStats.count} phân tích đã học` : 'ChromaDB chưa kết nối'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Mỗi lần chạy phân tích → kết quả tự động lưu vào RAG để cải thiện độ chính xác lần sau
              </div>
            </div>
          </div>
          {memoryStats?.enabled && (
            <div className="text-right">
              <div className="text-2xl font-bold text-brand-700">{memoryStats.count}</div>
              <div className="text-xs text-slate-400">knowledge entries</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex-1">
            <div className="text-xs font-semibold text-slate-600 mb-1">Google Sheets IDs (đã cấu hình)</div>
            <div className="space-y-1">
              {[
                { name: 'OPC_CoreData', id: '16991q6bJPKLRt8_8aI29m7CTfpepHqQF' },
                { name: 'OPC_FinancialData', id: '1Z2YsFXamos8IYVD6sFGuND5dXy96bPAc' },
                { name: 'OPC_RulesRAG', id: '1U3uMdlz0vdysokFVknU9VRE-DtapFfq-' },
              ].map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="text-green-500">✓</span>
                  <span className="font-medium text-slate-700 w-36">{s.name}</span>
                  <span className="font-mono text-slate-400 truncate">{s.id.slice(0, 20)}…</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={clearCache}
            disabled={clearing}
            className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <RefreshCw size={13} className={clearing ? 'animate-spin' : ''} />
            {clearing ? 'Đang reload…' : 'Reload cache'}
          </button>
        </div>
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Save size={15} /> Lưu cài đặt
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✅ Đã lưu!</span>}
      </div>
    </div>
  );
}
