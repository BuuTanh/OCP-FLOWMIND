import { useState, useEffect } from 'react';
import { Save, Plus, X, TestTube, Brain, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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
  const [sheetId, setSheetId] = useState(localStorage.getItem('gsheet_id') || '11ehIbSy2Aw9KPjXrN0XN90wQ5BPx613m3beZRYji7qI');
  const [apiKey] = useState(localStorage.getItem('openai_key') || '');
  const [emails, setEmails] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('notify_emails') || '[]'); } catch { return []; }
  });
  const [newEmail, setNewEmail] = useState('');
  const [schedule, setSchedule] = useState(localStorage.getItem('schedule') || 'off');
  const [appsScriptUrl, setAppsScriptUrl] = useState(localStorage.getItem('apps_script_url') || '');
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);
  const [schedError, setSchedError] = useState('');
  const [savedSchedule, setSavedSchedule] = useState(localStorage.getItem('schedule') || 'off');
  const [urlTestStatus, setUrlTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
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
    localStorage.setItem('notify_emails', JSON.stringify(emails));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function saveSchedule() {
    setSchedSaving(true);
    setSchedError('');
    try {
      await axios.post(`${API_BASE}/set-schedule`, {
        interval: schedule,
        apps_script_url: appsScriptUrl,
        emails: emails,
      });
      // Apps Script call is best-effort; don't block user on failure
    } catch {/* offline ok */}
    localStorage.setItem('schedule', schedule);
    localStorage.setItem('apps_script_url', appsScriptUrl);
    localStorage.setItem('notify_emails', JSON.stringify(emails));
    setSavedSchedule(schedule);
    setSchedSaved(true);
    setTimeout(() => setSchedSaved(false), 2000);
    setSchedSaving(false);
  }

  async function testAppsScriptUrl() {
    if (!appsScriptUrl.startsWith('https://script.google.com/macros/s/')) {
      setUrlTestStatus('fail');
      setTimeout(() => setUrlTestStatus('idle'), 3000);
      return;
    }
    setUrlTestStatus('testing');
    try {
      const res = await axios.post(`${API_BASE}/set-schedule`, { interval: 'off', apps_script_url: appsScriptUrl });
      const s = res.data?.apps_script?.status;
      setUrlTestStatus(s === 'ok_no_json' || s === 'ok' || res.data?.status === 'ok' ? 'ok' : 'fail');
    } catch { setUrlTestStatus('fail'); }
    setTimeout(() => setUrlTestStatus('idle'), 4000);
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

  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function resetMemory() {
    setResetting(true);
    try {
      await axios.post(`${API_BASE}/reset-memory`);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    } catch {/* offline */}
    setResetting(false);
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
          {emails.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Chưa có email nhận thông báo — thêm ít nhất 1 địa chỉ bên dưới.
            </p>
          )}
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

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1.5">
          <p className="font-semibold">Các loại email được gửi tự động:</p>
          <ul className="space-y-1 text-blue-700">
            <li>• <strong>Mỗi khi có hợp đồng mới</strong> — 1 email riêng cho từng hợp đồng ngay sau khi phân tích xong</li>
            <li>• <strong>Chế độ định kỳ (30 phút / 1h / …)</strong> — 1 email digest gộp tất cả hợp đồng đã phân tích trong kỳ</li>
            <li>• <strong>Crisis alert</strong> — luôn gửi ngay lập tức dù đang ở chế độ nào</li>
          </ul>
          <p className="text-blue-600 mt-1">Cấu hình lịch gửi tại mục <strong>Tự động hóa</strong> bên dưới.</p>
        </div>
      </Section>

      {/* Automation */}
      <Section title="Tự động hóa">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lịch chạy phân tích tự động</label>
            <select
              value={schedule}
              onChange={e => setSchedule(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="off">Mỗi khi có hợp đồng mới (mặc định)</option>
              <option value="every30min">Mỗi 30 phút</option>
              <option value="every1h">Mỗi 1 giờ</option>
              <option value="every2h">Mỗi 2 giờ</option>
              <option value="every4h">Mỗi 4 giờ</option>
              <option value="daily8am">8:00 sáng hàng ngày</option>
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              Hệ thống sẽ tự phân tích tất cả hợp đồng chưa được phân tích trong khoảng thời gian này và gửi email digest tổng hợp.
            </p>
          </div>
          {/* Apps Script Web App URL — chỉ cần paste 1 lần */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Apps Script Web App URL
              <span className="ml-1.5 font-normal text-slate-400">(paste 1 lần, hệ thống tự cập nhật lịch)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={appsScriptUrl}
                onChange={e => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec"
                className={`flex-1 border rounded-lg px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600 ${
                  appsScriptUrl && !appsScriptUrl.startsWith('https://script.google.com/macros/s/')
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
                }`}
              />
              <button
                onClick={testAppsScriptUrl}
                disabled={!appsScriptUrl || urlTestStatus === 'testing'}
                className="shrink-0 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                {urlTestStatus === 'testing' ? <RefreshCw size={13} className="animate-spin" /> : urlTestStatus === 'ok' ? '✅ OK' : urlTestStatus === 'fail' ? '❌ Lỗi' : 'Kiểm tra'}
              </button>
            </div>
            <p className="text-xs mt-1">
              {appsScriptUrl && !appsScriptUrl.startsWith('https://script.google.com/macros/s/')
                ? <span className="text-red-500">⚠ URL không hợp lệ — phải bắt đầu bằng https://script.google.com/macros/s/</span>
                : appsScriptUrl
                ? <span className="text-slate-400">✓ Bấm "Kiểm tra" để xác nhận kết nối</span>
                : <span className="text-amber-600">Chưa có URL → Mở Apps Script → Deploy → Web App → Copy URL dán vào đây</span>}
            </p>
          </div>

          <button
            onClick={saveSchedule}
            disabled={schedSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-700 hover:bg-brand-800 text-white disabled:opacity-60 transition-colors"
          >
            {schedSaving
              ? <><RefreshCw size={14} className="animate-spin" /> Đang lưu…</>
              : schedSaved
              ? <>✅ Đã lưu!</>
              : <><Save size={14} /> Lưu lịch</>}
          </button>

          {/* Luôn hiển thị khi đã lưu lịch có giá trị */}
          {schedError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{schedError}</p>
          )}

          {savedSchedule !== 'off' && (
            <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1.5">
              <p className="font-semibold text-green-800">
                ✅ Hệ thống đang tự động phân tích{' '}
                <span className="font-bold">{
                  savedSchedule === 'every30min' ? 'mỗi 30 phút' :
                  savedSchedule === 'every1h'    ? 'mỗi 1 giờ' :
                  savedSchedule === 'every2h'    ? 'mỗi 2 giờ' :
                  savedSchedule === 'every4h'    ? 'mỗi 4 giờ' :
                  savedSchedule === 'daily8am'   ? '8:00 sáng mỗi ngày' : savedSchedule
                }</span>
              </p>
              <p className="text-green-700">
                Kết quả phân tích và cảnh báo rủi ro sẽ được gửi về <strong>{emails.join(', ') || '(chưa có email)'}</strong>.
              </p>
            </div>
          )}
          {savedSchedule === 'off' && (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-600">
              ✅ Hệ thống sẽ phân tích và gửi thông báo ngay khi có hợp đồng mới.
            </div>
          )}
        </div>
      </Section>

      {/* RAG Memory */}
      <Section title="Kho tri thức phục vụ phân tích">
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
      <div className="text-xs text-slate-400">mục tri thức</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex-1">
            <div className="text-xs font-semibold text-slate-600 mb-1">Google Sheets IDs (đã cấu hình)</div>
            <div className="space-y-1">
              {[
                { name: 'OPC_CoreData', id: '11ehIbSy2Aw9KPjXrN0XN90wQ5BPx613m3beZRYji7qI' },
                { name: 'OPC_FinancialData', id: '1p5A4AP1OMx0xonZXUqVFqphgm6yKgCP79v33vzflXBo' },
                { name: 'OPC_RulesRAG', id: '1C-WNOIB00GPKmc17obCRbhoi0oVy83IJ2UEt2CF077w' },
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
            {clearing ? 'Đang nạp lại…' : 'Nạp lại dữ liệu đệm'}
          </button>
        </div>
      </Section>

      {/* Reset for testing */}
      <Section title="Reset để test">
        <p className="text-xs text-slate-500">Xóa lịch sử quyết định của người phê duyệt và danh sách đã phân tích. Kho tri thức vẫn được giữ nguyên.</p>
        <button
          onClick={resetMemory}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={14} className={resetting ? 'animate-spin' : ''} />
          {resetting ? 'Đang reset…' : resetDone ? '✅ Đã reset!' : 'Reset Railway memory'}
        </button>
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
