/**
 * OPC FlowMind — Auto-Analyze trigger
 *
 * Cách dùng:
 *   1. Mở Google Sheets OPC_CoreData
 *   2. Extensions → Apps Script → paste toàn bộ file này
 *   3. Chạy setupTrigger() MỘT LẦN để cài trigger
 *   4. Mỗi khi sheet 04_CONTRACTS có hàng mới → script tự phân tích và ghi kết quả
 *
 * Kết quả ghi vào sheet "AI_RESULTS" (tự tạo nếu chưa có).
 */

// ── Cấu hình ─────────────────────────────────────────────────────────────────

const RAILWAY_URL = 'https://ocp-flowmind-production.up.railway.app';
const CONTRACTS_SHEET = '04_CONTRACTS';   // tên tab chứa danh sách hợp đồng
const RESULTS_SHEET   = 'AI_RESULTS';     // tab ghi kết quả phân tích
const CONTRACT_ID_COL = 'A';              // cột chứa contract_id trong CONTRACTS_SHEET
const NOTIFY_EMAIL    = 'tanhtlb23411@st.uel.edu.vn';

// ── Cài trigger (chạy 1 lần) ─────────────────────────────────────────────────

function setupTrigger() {
  // Xóa trigger cũ tránh duplicate
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onSheetEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log('✅ Trigger đã cài. Mỗi lần thêm hợp đồng mới sẽ tự phân tích.');
}

// ── Handler chính ─────────────────────────────────────────────────────────────

function onSheetEdit(e) {
  // Chỉ xử lý khi sửa sheet hợp đồng
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONTRACTS_SHEET) return;

  const row  = e.range.getRow();
  const col  = e.range.getColumn();
  if (row <= 1) return;  // bỏ qua header

  // Chỉ trigger khi cột A (contract_id) vừa được điền
  if (col !== 1) return;
  const contractId = String(e.value || '').trim();
  if (!contractId) return;

  // Tránh phân tích trùng nếu đã có kết quả
  if (alreadyAnalyzed(contractId)) {
    Logger.log('⏭ ' + contractId + ' đã được phân tích trước đó, bỏ qua.');
    return;
  }

  Logger.log('🚀 Bắt đầu phân tích ' + contractId);
  runAnalysis(contractId);
}

// ── Gọi Railway backend ───────────────────────────────────────────────────────

function runAnalysis(contractId) {
  const payload = JSON.stringify({
    contract_id: contractId,
    crisis_resolved: false,
    resolved_items: []
  });

  let response;
  try {
    response = UrlFetchApp.fetch(RAILWAY_URL + '/analyze', {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
      // Railway cold start có thể 30-60s
      followRedirects: true,
    });
  } catch (err) {
    Logger.log('❌ Lỗi kết nối Railway: ' + err);
    sendErrorEmail(contractId, 'Không thể kết nối Railway: ' + err);
    return;
  }

  const code = response.getResponseCode();
  if (code !== 200) {
    Logger.log('❌ Railway trả về ' + code + ': ' + response.getContentText());
    sendErrorEmail(contractId, 'Railway lỗi ' + code + ': ' + response.getContentText().slice(0, 300));
    return;
  }

  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (err) {
    Logger.log('❌ Không parse được JSON: ' + err);
    return;
  }

  writeResult(contractId, result);
  sendSuccessEmail(contractId, result);
  Logger.log('✅ Phân tích xong: ' + contractId);
}

// ── Ghi kết quả vào sheet AI_RESULTS ─────────────────────────────────────────

function writeResult(contractId, result) {
  const ss    = SpreadsheetApp.getActive();
  let sheet   = ss.getSheetByName(RESULTS_SHEET);

  // Tạo sheet nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet(RESULTS_SHEET);
    sheet.appendRow([
      'Thời gian', 'Hợp đồng', 'Khuyến nghị', 'Confidence',
      'Alerts', 'Crisis', 'Ghi chú DPA'
    ]);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  // Trích thông tin từ kết quả
  const rec        = result?.zone_decision?.recommendation || '—';
  const confidence = result?.zone_decision?.confidence != null
                     ? (result.zone_decision.confidence * 100).toFixed(0) + '%'
                     : '—';
  const alerts     = (result?.zone_decision?.risk_alerts || []).length;
  const crisis     = result?.zone_workflow?.crisis_layer?.active ? '⚠ CÓ' : 'Không';
  const note       = (result?.zone_decision?.three_reasons || []).slice(0, 2).join(' | ');

  sheet.appendRow([
    new Date().toLocaleString('vi-VN'),
    contractId,
    rec,
    confidence,
    alerts,
    crisis,
    note
  ]);

  // Tô màu hàng theo recommendation
  const lastRow = sheet.getLastRow();
  const color   = rec === 'KÝ' ? '#e6f4ea' : rec === 'TỪ CHỐI' ? '#fce8e6' : '#fff8e1';
  sheet.getRange(lastRow, 1, 1, 7).setBackground(color);
}

// ── Kiểm tra đã phân tích chưa ───────────────────────────────────────────────

function alreadyAnalyzed(contractId) {
  const ss    = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return false;
  const ids = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  return ids.includes(contractId);
}

// ── Email thông báo ───────────────────────────────────────────────────────────

function sendSuccessEmail(contractId, result) {
  const rec        = result?.zone_decision?.recommendation || '—';
  const confidence = result?.zone_decision?.confidence != null
                     ? (result.zone_decision.confidence * 100).toFixed(0) + '%'
                     : '—';
  const alerts     = (result?.zone_decision?.risk_alerts || []).length;
  const crisis     = result?.zone_workflow?.crisis_layer?.active;
  const reasons    = (result?.zone_decision?.three_reasons || [])
                     .map((r, i) => '<li>' + (i+1) + '. ' + r + '</li>').join('');

  const recColor = rec === 'KÝ' ? '#1e7e34' : rec === 'TỪ CHỐI' ? '#c0392b' : '#e67e22';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">🤖 OPC FlowMind — Kết quả phân tích mới</h2>
  </div>
  <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin:0 0 16px">Hợp đồng <strong>${contractId}</strong> vừa được phân tích tự động.</p>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f5f5f5">
        <td style="padding:10px 14px;font-weight:bold">Khuyến nghị</td>
        <td style="padding:10px 14px;color:${recColor};font-weight:bold;font-size:18px">${rec}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold">Độ tin cậy</td>
        <td style="padding:10px 14px">${confidence}</td>
      </tr>
      <tr style="background:#f5f5f5">
        <td style="padding:10px 14px;font-weight:bold">Cảnh báo rủi ro</td>
        <td style="padding:10px 14px">${alerts} alert(s)</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold">Crisis Layer</td>
        <td style="padding:10px 14px">${crisis ? '⚠ Phát hiện giao dịch đáng ngờ' : '✅ Không có rủi ro'}</td>
      </tr>
    </table>
    ${reasons ? `<div style="margin-top:16px"><strong>Lý do chính:</strong><ul style="margin-top:8px">${reasons}</ul></div>` : ''}
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">
      <a href="https://ocpflowmind-ten.vercel.app" style="background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
        Xem chi tiết trên Dashboard →
      </a>
    </div>
  </div>
  <p style="color:#999;font-size:12px;margin-top:12px;text-align:center">OPC FlowMind Agentic AI — tự động gửi lúc ${new Date().toLocaleString('vi-VN')}</p>
</div>`;

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[OPC FlowMind] ${contractId} → ${rec} (${confidence})`,
    htmlBody: html,
  });
}

function sendErrorEmail(contractId, errorMsg) {
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[OPC FlowMind] ❌ Lỗi phân tích ${contractId}`,
    body: `Phân tích ${contractId} thất bại.\n\nLỗi: ${errorMsg}\n\nVui lòng kiểm tra Railway logs.`,
  });
}

// ── Phân tích thủ công (chạy từ Apps Script editor) ──────────────────────────

function manualAnalyze() {
  // Thay contract_id muốn test ở đây
  runAnalysis('CON-001');
}

/**
 * Phân tích TẤT CẢ hợp đồng trong sheet 04_CONTRACTS (dùng để chạy batch lần đầu)
 * Chạy từ Apps Script editor: chọn hàm → Run
 */
function analyzeAll() {
  const ss     = SpreadsheetApp.getActive();
  const sheet  = ss.getSheetByName(CONTRACTS_SHEET);
  if (!sheet) { Logger.log('Không tìm thấy sheet ' + CONTRACTS_SHEET); return; }

  const rows = sheet.getDataRange().getValues();
  // Tìm index cột contract_id (header hàng 1)
  const header = rows[0].map(h => String(h).toLowerCase().trim());
  const cidCol = header.indexOf('contract_id');
  if (cidCol < 0) { Logger.log('Không tìm thấy cột contract_id trong header'); return; }

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const contractId = String(rows[i][cidCol] || '').trim();
    if (!contractId) continue;
    Logger.log('📋 Phân tích ' + (i) + '/' + (rows.length - 1) + ': ' + contractId);
    runAnalysis(contractId);
    // Delay 3s giữa các request để Railway không bị overload
    Utilities.sleep(3000);
    count++;
  }
  Logger.log('✅ Đã phân tích ' + count + ' hợp đồng.');
}
