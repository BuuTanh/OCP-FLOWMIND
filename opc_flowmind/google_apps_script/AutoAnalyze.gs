/**
 * OPC FlowMind — Auto-Analyze trigger
 *
 * Cách dùng:
 *   1. Mở Google Sheets OPC_CoreData → Extensions → Apps Script → paste file này
 *   2. Chạy setupTrigger() MỘT LẦN để cài onEdit trigger
 *   3. Vào Settings trên web app → chọn lịch tự động → bấm "Lưu lịch"
 *      (hoặc chạy setupScheduledTrigger() thủ công từ editor)
 *
 * Kết quả ghi vào sheet "AI_RESULTS" (tự tạo nếu chưa có).
 */

// ── Cấu hình ─────────────────────────────────────────────────────────────────

const RAILWAY_URL      = 'https://ocp-flowmind-production.up.railway.app';
const CONTRACTS_SHEET  = '04_CONTRACTS';
const RESULTS_SHEET    = 'AI_RESULTS';
const NOTIFY_EMAIL_FALLBACK = 'tanhtlb23411@st.uel.edu.vn'; // dùng nếu chưa lưu email nào
const DECISION_SECRET  = 'opc-flowmind-2024';

// Tên các cột bắt buộc trước khi phân tích
const REQUIRED_FIELDS = ['contract_id', 'customer_id', 'contract_value', 'gross_margin', 'start_date', 'end_date'];

// ── 1. Cài onEdit trigger (chạy 1 lần) ───────────────────────────────────────

function setupTrigger() {
  _deleteTriggersFor('onSheetEdit');
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log('✅ onEdit trigger đã cài.');
}

// ── 2. Cài / cập nhật scheduled trigger ──────────────────────────────────────

/**
 * Gọi hàm này để cài lịch tự động.
 * interval: 'off' | 'every30min' | 'every1h' | 'every2h' | 'every4h' | 'daily8am'
 *
 * Frontend Settings gọi endpoint /set-schedule trên Railway → Railway gọi hàm này qua
 * PropertiesService, HOẶC user chạy trực tiếp từ Apps Script editor.
 */
function setupScheduledTrigger(interval) {
  // Đọc từ PropertiesService nếu không truyền tham số
  if (!interval) {
    interval = PropertiesService.getScriptProperties().getProperty('SCHEDULE_INTERVAL') || 'off';
  }

  // Xóa scheduled trigger cũ
  _deleteTriggersFor('runScheduled');

  if (interval === 'off') {
    Logger.log('⏹ Lịch tự động đã TẮT.');
    PropertiesService.getScriptProperties().setProperty('SCHEDULE_INTERVAL', 'off');
    return;
  }

  let trigger;
  if (interval === 'every30min') {
    trigger = ScriptApp.newTrigger('runScheduled').timeBased().everyMinutes(30).create();
  } else if (interval === 'every1h') {
    trigger = ScriptApp.newTrigger('runScheduled').timeBased().everyHours(1).create();
  } else if (interval === 'every2h') {
    trigger = ScriptApp.newTrigger('runScheduled').timeBased().everyHours(2).create();
  } else if (interval === 'every4h') {
    trigger = ScriptApp.newTrigger('runScheduled').timeBased().everyHours(4).create();
  } else if (interval === 'daily8am') {
    trigger = ScriptApp.newTrigger('runScheduled').timeBased()
      .everyDays(1).atHour(8).nearMinute(0).create();
  }

  PropertiesService.getScriptProperties().setProperty('SCHEDULE_INTERVAL', interval);
  Logger.log('✅ Lịch tự động: ' + interval);
}

// ── 3. Handler onEdit (thêm hợp đồng mới) ────────────────────────────────────

function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONTRACTS_SHEET) return;

  const startRow = e.range.getRow();
  const numRows  = e.range.getNumRows();
  if (startRow <= 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
                       .map(h => String(h).trim().toLowerCase());
  const cidIdx  = headers.indexOf('contract_id');
  if (cidIdx < 0) return;

  // Quét toàn bộ vùng vừa được paste (có thể nhiều hàng cùng lúc)
  const firstDataRow = startRow <= 1 ? 2 : startRow;
  const rangeData    = sheet.getRange(firstDataRow, 1, numRows, sheet.getLastColumn()).getValues();

  for (let i = 0; i < rangeData.length; i++) {
    const rowData    = rangeData[i];
    const contractId = String(rowData[cidIdx] || '').trim();
    if (!contractId) continue;

    const missing = REQUIRED_FIELDS.filter(field => {
      const idx = headers.indexOf(field.toLowerCase());
      if (idx < 0) return true;
      const val = String(rowData[idx] || '').trim();
      return val === '' || val === '0';
    });

    if (missing.length > 0) {
      Logger.log('⏳ ' + contractId + ' chưa đủ — thiếu: ' + missing.join(', '));
      continue;
    }

    if (alreadyAnalyzed(contractId)) {
      Logger.log('⏭ ' + contractId + ' đã phân tích, bỏ qua.');
      continue;
    }

    // Dùng lock để tránh onEdit + runScheduled gửi email trùng nhau
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      // Kiểm tra lại sau khi có lock (có thể thread khác đã xử lý)
      if (alreadyAnalyzed(contractId)) {
        Logger.log('⏭ ' + contractId + ' đã được xử lý bởi thread khác.');
        continue;
      }
      markAnalyzed(contractId); // đánh dấu ngay để block mọi execution sau
      Logger.log('🚀 Thêm mới → phân tích ' + contractId);
      const result = runAnalysis(contractId);
      if (result) {
        writeResult(contractId, result); // ghi sheet TRƯỚC để tránh duplicate

        // Chỉ gửi email ngay nếu đang ở chế độ tắt lịch (interval = 'off')
        // Nếu có lịch (30 phút, 1 giờ...) thì để runScheduled gửi digest
        const currentInterval = _getCurrentInterval();
        if (currentInterval === 'off') {
          sendSingleEmail(contractId, result);
        } else {
          Logger.log('⏳ ' + contractId + ' đã phân tích, chờ runScheduled gửi digest (' + currentInterval + ')');
        }
      }
    } finally {
      lock.releaseLock();
    }
  }
}

// ── 4. Scheduled job — chạy định kỳ ─────────────────────────────────────────

function runScheduled() {
  // Kiểm tra chế độ hiện tại — nếu mặc định (off) thì không làm gì
  const interval = _getCurrentInterval();
  if (interval === 'off') {
    Logger.log('⏭ runScheduled: đang ở chế độ mặc định, bỏ qua.');
    return;
  }

  const ss    = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONTRACTS_SHEET);
  if (!sheet) return;

  // Gom các contract đã phân tích (có trong AI_RESULTS) nhưng chưa gửi email digest
  const pendingResults = _getPendingEmailResults();

  if (pendingResults.length === 0) {
    Logger.log('✅ Scheduled run: không có hợp đồng nào chờ gửi email.');
    return;
  }

  Logger.log('📧 Scheduled run: gửi digest cho ' + pendingResults.length + ' hợp đồng...');
  sendDigestEmail(pendingResults, interval);
  _markEmailSent(pendingResults.map(r => r.contractId));
  Logger.log('✅ Scheduled run hoàn tất.');
}

// ── 5. Gọi Railway backend ────────────────────────────────────────────────────

function runAnalysis(contractId) {
  const payload = JSON.stringify({ contract_id: contractId, crisis_resolved: false, resolved_items: [] });

  let response;
  try {
    response = UrlFetchApp.fetch(RAILWAY_URL + '/analyze', {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
      followRedirects: true,
    });
  } catch (err) {
    Logger.log('❌ Kết nối Railway thất bại (' + contractId + '): ' + err);
    return null;
  }

  const code = response.getResponseCode();
  if (code !== 200) {
    Logger.log('❌ Railway ' + code + ' (' + contractId + '): ' + response.getContentText().slice(0, 200));
    return null;
  }

  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (err) {
    Logger.log('❌ Parse JSON thất bại (' + contractId + '): ' + err);
    return null;
  }

  return result;
}

// ── 6. Ghi kết quả vào AI_RESULTS ────────────────────────────────────────────

function writeResult(contractId, result) {
  const ss  = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(RESULTS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(RESULTS_SHEET);
    sheet.appendRow(['Thời gian', 'Hợp đồng', 'Khuyến nghị', 'Confidence', 'Alerts', 'Crisis', 'Ghi chú DPA', 'email_sent']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  const rec        = result?.zone_decision?.recommendation || '—';
  const confidence = result?.zone_decision?.confidence_score != null
                     ? (result.zone_decision.confidence_score * 100).toFixed(0) + '%' : '—';
  const alerts     = (result?.zone_decision?.risk_alerts || []).length;
  const crisis     = result?.zone_workflow?.crisis_layer?.active ? '⚠ CÓ' : 'Không';
  const note       = (result?.zone_decision?.three_reasons || []).slice(0, 2).join(' | ');

  // email_sent để trống — runScheduled sẽ điền timestamp sau khi gửi digest
  sheet.appendRow([new Date().toLocaleString('vi-VN'), contractId, rec, confidence, alerts, crisis, note, '']);

  const lastRow = sheet.getLastRow();
  const color   = rec === 'KY' ? '#e6f4ea' : rec === 'KHONG_KY' ? '#fce8e6' : '#fff8e1';
  sheet.getRange(lastRow, 1, 1, 8).setBackground(color);
}

// ── 7. Email: gửi riêng (khi thêm mới) ───────────────────────────────────────

function sendSingleEmail(contractId, result) {
  const rec        = result?.zone_decision?.recommendation || '—';
  const confidence = result?.zone_decision?.confidence_score != null
                     ? (result.zone_decision.confidence_score * 100).toFixed(0) + '%' : '—';
  const alerts     = (result?.zone_decision?.risk_alerts || []).length;
  const crisis     = result?.zone_workflow?.crisis_layer?.active;
  const mdToHtml = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const reasons    = (result?.zone_decision?.three_reasons || [])
                     .map((r, i) => `<li style="margin-bottom:6px">${i+1}. ${mdToHtml(r)}</li>`).join('');
  const recColor   = rec === 'KY' ? '#1e7e34' : rec === 'KHONG_KY' ? '#c0392b' : rec === 'CHUA_DU_DU_LIEU' ? '#7f8c8d' : '#e67e22';
  const recLabel   = rec === 'KY' ? '✅ KÝ HỢP ĐỒNG' : rec === 'KHONG_KY' ? '❌ KHÔNG KÝ' : rec === 'CHUA_DU_DU_LIEU' ? '⏳ CHƯA ĐỦ DỮ LIỆU' : '⚠ KÝ CÓ ĐIỀU KIỆN';

  // Tạo token cho từng nút quyết định
  const tokenKy      = _makeToken(contractId, 'KY');
  const tokenKhongKy = _makeToken(contractId, 'KHONG_KY');
  const tokenYeuCau  = _makeToken(contractId, 'YEU_CAU');

  const base = RAILWAY_URL + '/decision?contract=' + contractId;
  const urlKy      = base + '&action=KY&token='      + tokenKy;
  const urlKhongKy = base + '&action=KHONG_KY&token=' + tokenKhongKy;
  const urlYeuCau  = base + '&action=YEU_CAU&token='  + tokenYeuCau;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <div style="font-size:12px;opacity:.7;margin-bottom:4px;letter-spacing:.5px">OPC FLOWMIND AGENTIC AI</div>
    <h2 style="margin:0;font-size:20px">Hợp đồng mới cần xem xét: ${contractId}</h2>
  </div>
  <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr style="background:#f5f5f5">
        <td style="padding:10px 14px;font-weight:bold;width:140px;color:#555">Khuyến nghị AI</td>
        <td style="padding:10px 14px;color:${recColor};font-weight:bold;font-size:17px">${recLabel}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555">Độ tin cậy</td>
        <td style="padding:10px 14px;font-weight:bold">${confidence}</td>
      </tr>
      <tr style="background:#f5f5f5">
        <td style="padding:10px 14px;font-weight:bold;color:#555">Cảnh báo rủi ro</td>
        <td style="padding:10px 14px">${alerts} alert${alerts !== 1 ? 's' : ''}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555">Crisis Layer</td>
        <td style="padding:10px 14px">${crisis ? '⚠ Phát hiện giao dịch đáng ngờ' : '✅ Không có rủi ro'}</td>
      </tr>
    </table>

    ${reasons ? `<div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb"><strong style="color:#1e3a5f">Lý do chính từ AI:</strong><ul style="margin:10px 0 0;padding-left:20px;color:#374151">${reasons}</ul></div>` : ''}

    <!-- Founder action buttons -->
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 14px;font-weight:bold;color:#92400e;font-size:14px">⚡ Hành động của Founder — click để xác nhận:</p>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:0 6px 0 0;width:33%">
            <a href="${urlKy}"
               style="display:block;background:#1e7e34;color:#fff;text-align:center;padding:12px 8px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">
              ✅ Ký hợp đồng
            </a>
          </td>
          <td style="padding:0 3px;width:33%">
            <a href="${urlKhongKy}"
               style="display:block;background:#c0392b;color:#fff;text-align:center;padding:12px 8px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">
              ❌ Từ chối ký
            </a>
          </td>
          <td style="padding:0 0 0 6px;width:34%">
            <a href="${urlYeuCau}"
               style="display:block;background:#e67e22;color:#fff;text-align:center;padding:12px 8px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">
              📋 Yêu cầu bổ sung
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding-top:16px;border-top:1px solid #eee">
      <a href="https://ocpflowmind-ten.vercel.app/pipeline?contract=${contractId}"
         style="background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">
        Xem phân tích chi tiết →
      </a>
    </div>
  </div>
  <p style="color:#999;font-size:12px;margin-top:12px;text-align:center">
    OPC FlowMind Agentic AI — ${new Date().toLocaleString('vi-VN')}
  </p>
</div>`;

  MailApp.sendEmail({
    to: _getNotifyEmails(),
    subject: `[OPC FlowMind] ${contractId} → ${recLabel} (${confidence}) — Cần Founder xét duyệt`,
    htmlBody: html,
  });
}

// ── 8. Email: digest (khi scheduled chạy nhiều hợp đồng) ─────────────────────

function sendDigestEmail(results, interval) {
  const intervalLabel = {
    'every30min': 'mỗi 30 phút', 'every1h': 'mỗi 1 giờ',
    'every2h': 'mỗi 2 giờ', 'every4h': 'mỗi 4 giờ', 'daily8am': 'hàng ngày lúc 8:00'
  }[interval] || interval;

  const rows = results.map(({ contractId, result }) => {
    const rec        = result?.zone_decision?.recommendation || '—';
    const confidence = result?.zone_decision?.confidence_score != null
                       ? (result.zone_decision.confidence_score * 100).toFixed(0) + '%' : '—';
    const alerts     = (result?.zone_decision?.risk_alerts || []).length;
    const crisis     = result?.zone_workflow?.crisis_layer?.active;
    const recColor   = rec === 'KY' ? '#1e7e34' : rec === 'KHONG_KY' ? '#c0392b' : rec === 'CHUA_DU_DU_LIEU' ? '#7f8c8d' : '#e67e22';
    const recLabel   = rec === 'KY' ? '✅ KÝ' : rec === 'KHONG_KY' ? '❌ KHÔNG KÝ' : rec === 'CHUA_DU_DU_LIEU' ? '⏳ CHƯA ĐỦ DL' : '⚠ CÓ ĐK';
    const link       = `https://ocpflowmind-ten.vercel.app/pipeline?contract=${contractId}`;
    return `
      <tr>
        <td style="padding:10px 14px;font-weight:bold">
          <a href="${link}" style="color:#1e3a5f;text-decoration:none">${contractId}</a>
        </td>
        <td style="padding:10px 14px;color:${recColor};font-weight:bold">${recLabel}</td>
        <td style="padding:10px 14px">${confidence}</td>
        <td style="padding:10px 14px">${alerts} alert${alerts !== 1 ? 's' : ''}</td>
        <td style="padding:10px 14px">${crisis ? '⚠ CÓ' : '—'}</td>
      </tr>`;
  }).join('');

  const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
  <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">🤖 OPC FlowMind — Báo cáo định kỳ (${intervalLabel})</h2>
    <p style="margin:6px 0 0;opacity:.8;font-size:14px">${results.length} hợp đồng được phân tích lúc ${new Date().toLocaleString('vi-VN')}</p>
  </div>
  <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f5f5f5;font-weight:bold">
          <th style="padding:10px 14px;text-align:left">Hợp đồng</th>
          <th style="padding:10px 14px;text-align:left">Khuyến nghị</th>
          <th style="padding:10px 14px;text-align:left">Confidence</th>
          <th style="padding:10px 14px;text-align:left">Alerts</th>
          <th style="padding:10px 14px;text-align:left">Crisis</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">
      <a href="https://ocpflowmind-ten.vercel.app/dashboard"
         style="background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
        Mở Dashboard →
      </a>
    </div>
  </div>
  <p style="color:#999;font-size:12px;margin-top:12px;text-align:center">OPC FlowMind Agentic AI</p>
</div>`;

  const needAction = results.filter(({ result }) => {
    const rec = result?.zone_decision?.recommendation || '';
    return rec === 'KHONG_KY' || result?.zone_workflow?.crisis_layer?.active;
  }).length;

  const subject = needAction > 0
    ? `[OPC FlowMind] ⚠ ${needAction} hợp đồng cần chú ý — Báo cáo ${intervalLabel}`
    : `[OPC FlowMind] ✅ Báo cáo định kỳ — ${results.length} hợp đồng OK`;

  MailApp.sendEmail({ to: _getNotifyEmails(), subject, htmlBody: html });
}

// ── 9. Helpers ────────────────────────────────────────────────────────────────

/** Kiểm tra contract đã có trong AI_RESULTS sheet chưa */
function alreadyAnalyzed(contractId) {
  // Kiểm tra PropertiesService trước (nhanh, tránh duplicate trong cùng session)
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('analyzed_' + contractId) === '1') return true;

  // Kiểm tra sheet AI_RESULTS
  const ss    = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return false;
  const data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  return data.some(function(row) { return String(row[0]).trim() === contractId; });
}

function markAnalyzed(contractId) {
  PropertiesService.getScriptProperties().setProperty('analyzed_' + contractId, '1');
}

/** MD5 token cho decision buttons — phải khớp với _make_token() trong api.py */
function _makeToken(contractId, action) {
  const raw   = contractId + ':' + action + ':' + DECISION_SECRET;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

// Lấy danh sách kết quả từ AI_RESULTS chưa gửi email (email_sent trống)
function _getPendingEmailResults() {
  const ss    = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data    = sheet.getDataRange().getValues();
  const header  = data[0].map(h => String(h).toLowerCase().trim());
  const cidIdx  = header.indexOf('hợp đồng');
  const sentIdx = header.indexOf('email_sent');
  if (cidIdx < 0 || sentIdx < 0) return [];

  // Gom theo contractId, ưu tiên hàng cuối cùng (mới nhất)
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const cid  = String(data[i][cidIdx] || '').trim();
    const sent = String(data[i][sentIdx] || '').trim();
    if (!cid) continue;
    if (sent === '') map[cid] = i; // chưa gửi → ghi nhớ row index
  }

  const pending = [];
  for (const [contractId, rowIdx] of Object.entries(map)) {
    const row = data[rowIdx];
    // Tái tạo result object tối giản để sendDigestEmail dùng được
    const rec        = String(row[header.indexOf('khuyến nghị')] || '');
    const confRaw = row[header.indexOf('confidence')];
    // Xử lý tất cả định dạng: number 0.64, string "64%", string "64", string "0.64"
    const confNum = (function() {
      if (typeof confRaw === 'number') return confRaw; // Sheets đã parse sẵn
      const s = String(confRaw).replace('%', '').trim();
      const n = parseFloat(s);
      if (isNaN(n)) return 0;
      return n > 1 ? n / 100 : n; // "64" → 0.64 | "0.64" → 0.64
    })();
    const alerts     = Number(row[header.indexOf('alerts')]      || 0);
    const crisis     = String(row[header.indexOf('crisis')]      || '').includes('CÓ');
    const note       = String(row[header.indexOf('ghi chú dpa')] || '');
    pending.push({
      contractId,
      rowNum: rowIdx + 1,
      result: {
        zone_decision: {
          recommendation:   rec,
          confidence_score: confNum || 0,
          risk_alerts:      Array(alerts).fill('alert'),
          three_reasons:    note ? note.split(' | ') : [],
        },
        zone_workflow: { crisis_layer: { active: crisis } },
      },
    });
  }
  return pending;
}

// Đánh dấu email_sent = timestamp cho các contractId đã gửi
function _markEmailSent(contractIds) {
  const ss    = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return;

  const data    = sheet.getDataRange().getValues();
  const header  = data[0].map(h => String(h).toLowerCase().trim());
  const cidIdx  = header.indexOf('hợp đồng');
  const sentIdx = header.indexOf('email_sent');
  if (cidIdx < 0 || sentIdx < 0) return;

  const idSet = new Set(contractIds);
  const now   = new Date().toLocaleString('vi-VN');
  for (let i = 1; i < data.length; i++) {
    const cid  = String(data[i][cidIdx] || '').trim();
    const sent = String(data[i][sentIdx] || '').trim();
    if (idSet.has(cid) && sent === '') {
      sheet.getRange(i + 1, sentIdx + 1).setValue(now);
    }
  }
}

// Đọc interval hiện tại từ Railway, fallback PropertiesService
function _getCurrentInterval() {
  // PropertiesService là nguồn duy nhất — được cập nhật mỗi khi user lưu lịch trên web
  // Không gọi Railway vì app.state mất khi Railway restart → không đáng tin
  return PropertiesService.getScriptProperties().getProperty('SCHEDULE_INTERVAL') || 'off';
}

function _deleteTriggersFor(fnName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === fnName) ScriptApp.deleteTrigger(t);
  });
}

function _intervalToMs(interval) {
  return { 'every30min': 30, 'every1h': 60, 'every2h': 120, 'every4h': 240, 'daily8am': 1440 }[interval] * 60 * 1000 || 3600000;
}

// Lấy danh sách contractId đã phân tích: từ AI_RESULTS sheet + từ web app (Railway)
function _getRecentlyAnalyzedIds(windowMs) {
  const ids    = new Set();
  const cutoff = new Date(Date.now() - windowMs);

  // 1. Từ AI_RESULTS sheet (phân tích qua Apps Script)
  const ss    = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (const [timeStr, contractId] of data) {
      if (!contractId) continue;
      const t = new Date(timeStr);
      if (!isNaN(t) && t >= cutoff) ids.add(String(contractId).trim());
    }
  }

  // 2. Từ web app Railway (phân tích qua giao diện web — đồng bộ để tránh chạy lại)
  try {
    const resp = UrlFetchApp.fetch(RAILWAY_URL + '/get-web-analyzed', {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    if (resp.getResponseCode() === 200) {
      const webAnalyzed = JSON.parse(resp.getContentText());
      for (const [contractId, info] of Object.entries(webAnalyzed)) {
        const t = new Date(info.timestamp);
        if (!isNaN(t) && t >= cutoff) ids.add(String(contractId).trim());
      }
    }
  } catch (e) {
    Logger.log('⚠ Không lấy được web-analyzed từ Railway: ' + e);
  }

  return ids;
}

// ── 10. Web App endpoint — Railway gọi để cập nhật lịch tự động ──────────────

/**
 * Deploy as Web App (Execute as: Me, Access: Anyone) để Railway có thể gọi.
 * URL dạng: https://script.google.com/macros/s/XXXX/exec?interval=every30min
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'set_schedule';

  // Ghi DECISION_CARD khi founder click button email
  if (action === 'write_decision') {
    return _handleWriteDecision(e.parameter);
  }

  const interval = (e && e.parameter && e.parameter.interval) ? e.parameter.interval : 'off';
  const valid    = ['off', 'every30min', 'every1h', 'every2h', 'every4h', 'daily8am'];

  if (valid.indexOf(interval) < 0) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'interval không hợp lệ: ' + interval })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // Lưu emails nếu có
  const emailsParam = (e && e.parameter && e.parameter.emails) ? e.parameter.emails : '';
  if (emailsParam) {
    PropertiesService.getScriptProperties().setProperty('NOTIFY_EMAILS', emailsParam);
  }

  setupScheduledTrigger(interval);

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', interval: interval, emails_saved: !!emailsParam })
  ).setMimeType(ContentService.MimeType.JSON);
}

// Trả về danh sách email nhận thông báo (từ PropertiesService hoặc fallback)
function _getNotifyEmails() {
  const saved = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAILS') || '';
  if (saved) return saved; // "a@x.com,b@y.com"
  return NOTIFY_EMAIL_FALLBACK;
}

function _handleWriteDecision(params) {
  try {
    const contractId      = params.contract_id || '';
    const decision        = params.decision || '';
    const confidenceScore = params.confidence_score || '';
    const timestamp       = params.timestamp || new Date().toISOString();

    if (!contractId || !decision) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'Thiếu contract_id hoặc decision' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName('DECISION_CARD');
    if (!sheet) {
      sheet = ss.insertSheet('DECISION_CARD');
      sheet.appendRow(['Thời gian', 'Hợp đồng', 'Quyết định', 'Confidence Score']);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }

    sheet.appendRow([timestamp, contractId, decision, confidenceScore]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', contract_id: contractId, decision: decision })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 11. Hàm tiện ích (chạy thủ công từ editor) ───────────────────────────────

/** Test phân tích 1 hợp đồng */
function manualAnalyze() {
  const contractId = 'CON-001'; // thay contract_id muốn test
  const result = runAnalysis(contractId);
  if (result) sendSingleEmail(contractId, result);
}

/** Phân tích tất cả (batch lần đầu) */
function analyzeAll() {
  const ss     = SpreadsheetApp.getActive();
  const sheet  = ss.getSheetByName(CONTRACTS_SHEET);
  if (!sheet) return;

  const rows   = sheet.getDataRange().getValues();
  const header = rows[0].map(h => String(h).toLowerCase().trim());
  const cidCol = header.indexOf('contract_id');
  if (cidCol < 0) return;

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const contractId = String(rows[i][cidCol] || '').trim();
    if (!contractId) continue;
    Logger.log('📋 ' + i + '/' + (rows.length - 1) + ': ' + contractId);
    const result = runAnalysis(contractId);
    if (result) results.push({ contractId, result });
    Utilities.sleep(3000);
  }
  if (results.length > 0) sendDigestEmail(results, 'analyzeAll');
  Logger.log('✅ Xong: ' + results.length + ' hợp đồng.');
}

/** Xóa flag analyzed_* để test lại từ đầu — giữ nguyên SCHEDULE_INTERVAL và NOTIFY_EMAILS */
function clearAnalyzedFlags() {
  const props = PropertiesService.getScriptProperties();
  const all   = props.getProperties();
  const keep  = ['SCHEDULE_INTERVAL', 'NOTIFY_EMAILS'];
  Object.keys(all).forEach(k => {
    if (!keep.includes(k)) props.deleteProperty(k);
  });
  Logger.log('✅ Đã xóa flag analyzed — SCHEDULE_INTERVAL giữ nguyên: ' + (props.getProperty('SCHEDULE_INTERVAL') || 'off'));
}

/** Xem lịch triggers hiện tại */
function listTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(t.getHandlerFunction() + ' — ' + t.getTriggerSource());
  });
}
