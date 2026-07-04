"""
FastAPI server — n8n gọi vào đây qua HTTP Request nodes.
Chạy: uvicorn api:app --reload --port 8000
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
import json
import hashlib
from datetime import datetime

from agents.crisis_layer import run_crisis_scan
from agents.dfa import DataFinanceAgent
from agents.rca import RiskComplianceAgent
from agents.dpa import DecisionPartnerAgent
from models.financial import FinancialProposal
from models.risk import RiskAssessment
from output.schema import build_final_output
from config import TARGET_CONTRACT_ID
from data import gsheet_loader
from rag import memory as rag_memory

app = FastAPI(title="OPC FlowMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request schemas ──────────────────────────────────────────────────────

class ContractRequest(BaseModel):
    contract_id: str = TARGET_CONTRACT_ID

class RCARequest(BaseModel):
    contract_id: str = TARGET_CONTRACT_ID
    financial_proposal: dict   # serialized FinancialProposal

class DPARequest(BaseModel):
    financial_proposal: dict
    risk_assessment: dict
    crisis_resolved: bool = False

class BuildOutputRequest(BaseModel):
    crisis_result: dict
    financial_proposal: dict
    risk_assessment: dict
    decision_card: dict

class PipelineRequest(BaseModel):
    contract_id: str = TARGET_CONTRACT_ID
    founder_crisis_resolved: bool = False

# ── Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "system": "OPC FlowMind v1.0"}


@app.post("/api/crisis_scan")
def api_crisis_scan(req: ContractRequest):
    """
    n8n Step 1 — Crisis Layer
    Phát hiện TXN risk >= 85, trả về crisis status.
    """
    result = run_crisis_scan()
    # Serialize CrisisAlert nếu có
    if result.get("alert"):
        result["alert"] = result["alert"].model_dump()
    if result.get("log"):
        result["log"] = result["log"].model_dump()
    result.pop("hold_api_response", None)   # không cần gửi về n8n
    return result


@app.post("/api/dfa")
def api_dfa(req: ContractRequest):
    """
    n8n Step 2 — Data & Finance Agent
    Đọc cashflow, invoices, bank_txn → trả FinancialProposal + log
    """
    agent = DataFinanceAgent()
    result = agent.run({"contract_id": req.contract_id})
    return {
        "output": result["output"].model_dump(),
        "log":    result["log"].model_dump()
    }


@app.post("/api/rca")
def api_rca(req: RCARequest):
    """
    n8n Step 3 — Risk & Compliance Agent
    Nhận FinancialProposal (dict) → trả RiskAssessment + log
    """
    try:
        financial = FinancialProposal(**req.financial_proposal)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid financial_proposal: {e}")

    agent = RiskComplianceAgent()
    result = agent.run({"financial_proposal": financial})
    return {
        "output": result["output"].model_dump(),
        "log":    result["log"].model_dump()
    }


@app.post("/api/dpa")
def api_dpa(req: DPARequest):
    """
    n8n Step 4 — Decision & Partner Agent
    Nhận financial + risk → trả DecisionCard + log
    """
    try:
        financial = FinancialProposal(**req.financial_proposal)
        risk      = RiskAssessment(**req.risk_assessment)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid input: {e}")

    agent = DecisionPartnerAgent()
    result = agent.run({
        "financial_proposal": financial,
        "risk_assessment":    risk,
        "crisis_resolved":    req.crisis_resolved
    })
    return {
        "output": result["output"].model_dump(),
        "log":    result["log"].model_dump()
    }


@app.post("/api/build_output")
def api_build_output(req: BuildOutputRequest):
    """
    n8n Step 5 — Assemble final JSON output cho UI
    """
    from models.financial import FinancialProposal
    from models.risk import RiskAssessment
    from models.decision import DecisionCard

    try:
        financial     = FinancialProposal(**req.financial_proposal)
        risk          = RiskAssessment(**req.risk_assessment)
        decision      = DecisionCard(**req.decision_card)
        crisis_result = req.crisis_result

        # Re-wrap CrisisAlert nếu có
        if crisis_result.get("alert"):
            from models.decision import CrisisAlert
            crisis_result = dict(crisis_result)
            crisis_result["alert"] = CrisisAlert(**crisis_result["alert"])
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid input: {e}")

    return build_final_output(
        crisis_result=crisis_result,
        financial_proposal=financial,
        risk_assessment=risk,
        decision_card=decision,
        agent_logs=[]
    )


@app.post("/api/run_pipeline")
def api_run_pipeline(req: PipelineRequest):
    """
    Full pipeline trong 1 call — dùng khi không cần n8n step-by-step.
    n8n có thể gọi endpoint này thay vì gọi từng bước.
    """
    from main import run_pipeline
    result = run_pipeline(
        contract_id=req.contract_id,
        founder_crisis_resolved=req.founder_crisis_resolved
    )
    return result


# ── React Frontend Endpoints ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    contract_id: str = "CON-001"
    crisis_resolved: bool = False
    resolved_items: list[str] = []   # IDs đã được founder xác nhận xử lý

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    """
    Full pipeline trong 1 call — React frontend gọi endpoint này.
    resolved_items: danh sách alert_id/record_id đã được founder tick xử lý xong.
    """
    from main import run_pipeline
    import threading
    # Luôn đọc data mới nhất từ Google Sheets trước mỗi lần phân tích
    gsheet_loader.invalidate_cache()
    result = run_pipeline(
        contract_id=req.contract_id,
        founder_crisis_resolved=req.crisis_resolved,
        resolved_items=req.resolved_items
    )

    # Agentic Memory: lưu vào RAG trong background — không block HTTP response
    threading.Thread(
        target=rag_memory.store_analysis,
        args=(req.contract_id, result),
        daemon=True
    ).start()

    # Ghi nhận contract đã phân tích qua web (để Apps Script đồng bộ)
    if not hasattr(app.state, "web_analyzed"):
        app.state.web_analyzed = {}
    app.state.web_analyzed[req.contract_id] = {
        "recommendation": result.get("zone_decision", {}).get("recommendation", "—"),
        "confidence":     result.get("zone_decision", {}).get("confidence_score", 0),
        "alerts":         len(result.get("zone_decision", {}).get("risk_alerts", [])),
        "crisis":         result.get("zone_workflow", {}).get("crisis_layer", {}).get("active", False),
        "timestamp":      datetime.now().isoformat(),
    }

    return result


@app.get("/contracts")
def get_contracts():
    """Danh sách hợp đồng từ Google Sheets (OPC_CoreData tab 04_CONTRACTS)."""
    try:
        rows = gsheet_loader.get_contracts()
        result = []
        for r in rows:
            result.append({
                "contract_id":    r.get("contract_id", ""),
                "customer_id":    r.get("customer_id", ""),
                "description":    r.get("description", ""),
                "contract_value": _safe_float(r.get("contract_value", 0)),
                "gross_margin":   _safe_float(r.get("gross_margin", 0)),
                "status":         r.get("status", "Active"),
                "start_date":     r.get("start_date", ""),
                "end_date":       r.get("end_date", ""),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cashflow")
def get_cashflow(contract_id: Optional[str] = None):
    """Dữ liệu cashflow từ Google Sheets (OPC_FinancialData tab 09_CASHFLOW)."""
    try:
        rows = gsheet_loader.get_cashflow()
        result = []
        for r in rows:
            closing = _safe_float(r.get("projected_closing_cash", 0))
            if closing < 0:
                status = "CRITICAL"
            elif closing < 550_000_000:
                status = "WARNING"
            else:
                status = "OK"
            result.append({
                "month":                  r.get("month", ""),
                "expected_cash_in":       _safe_float(r.get("expected_cash_in", 0)),
                "expected_cash_out":      _safe_float(r.get("expected_cash_out", 0)),
                "projected_closing_cash": closing,
                "status":                 status,
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts")
def get_alerts():
    """Risk alerts hiện tại."""
    try:
        rows = gsheet_loader.get_risk_rules()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/stats")
def memory_stats():
    """RAG memory stats — bao nhiêu phân tích đã được học."""
    return rag_memory.get_memory_stats()


@app.post("/memory/invalidate")
def memory_invalidate():
    """Xóa cache Google Sheets để force reload."""
    gsheet_loader.invalidate_cache()
    return {"status": "cache cleared"}


_DECISION_SECRET = "opc-flowmind-2024"
_VALID_ACTIONS   = {"KY", "KHONG_KY", "YEU_CAU"}
_VALID_INTERVALS = {"off", "every30min", "every1h", "every2h", "every4h", "daily8am"}


def _make_token(contract_id: str, action: str) -> str:
    raw = f"{contract_id}:{action}:{_DECISION_SECRET}"
    return hashlib.md5(raw.encode()).hexdigest()


@app.get("/decision", response_class=HTMLResponse)
def founder_decision(contract: str = "", action: str = "", token: str = ""):
    """Founder click email button → update decision → return HTML confirmation."""
    if not contract or not action or not token:
        return HTMLResponse(_html_error("Thiếu tham số", "Link không hợp lệ."), status_code=400)

    if action not in _VALID_ACTIONS:
        return HTMLResponse(_html_error("Hành động không hợp lệ", f"action={action} không được hỗ trợ."), status_code=400)

    expected = _make_token(contract, action)
    if token != expected:
        return HTMLResponse(_html_error("Xác thực thất bại", "Token không đúng hoặc đã hết hạn."), status_code=403)

    # Store decision in memory
    if not hasattr(app.state, "decisions"):
        app.state.decisions = {}
    from datetime import datetime
    app.state.decisions[contract] = {
        "action": action,
        "timestamp": datetime.now().isoformat(),
    }

    label_map = {"KY": "✅ Đã ký hợp đồng", "KHONG_KY": "❌ Từ chối ký", "YEU_CAU": "📋 Yêu cầu bổ sung thông tin"}
    color_map = {"KY": "#1e7e34", "KHONG_KY": "#c0392b", "YEU_CAU": "#e67e22"}
    label = label_map[action]
    color = color_map[action]
    pipeline_url = f"https://ocpflowmind-ten.vercel.app/pipeline?contract={contract}"

    return HTMLResponse(_html_confirm(contract, label, color, pipeline_url))


@app.get("/get-decisions")
def get_decisions():
    """Frontend polls to get all founder decisions."""
    decisions = getattr(app.state, "decisions", {})
    return decisions


@app.get("/get-web-analyzed")
def get_web_analyzed():
    """Apps Script gọi để biết contract nào đã phân tích qua web — tránh chạy lại."""
    return getattr(app.state, "web_analyzed", {})


def _html_confirm(contract: str, label: str, color: str, pipeline_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OPC FlowMind — Xác nhận</title>
<style>
  body{{font-family:Arial,sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
  .card{{background:#fff;border-radius:12px;padding:40px 48px;max-width:480px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,.1);text-align:center}}
  .logo{{font-size:13px;color:#888;margin-bottom:24px;letter-spacing:.5px}}
  .badge{{display:inline-block;font-size:22px;font-weight:bold;color:{color};background:{color}18;border:2px solid {color}40;border-radius:10px;padding:14px 28px;margin:12px 0 24px}}
  h2{{margin:0 0 8px;color:#1e3a5f;font-size:20px}}
  p{{color:#555;font-size:15px;line-height:1.6;margin:0 0 28px}}
  a.btn{{display:inline-block;background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;transition:background .2s}}
  a.btn:hover{{background:#152d4a}}
  .time{{color:#aaa;font-size:12px;margin-top:24px}}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🤖 OPC FlowMind Agentic AI</div>
  <h2>Quyết định đã ghi nhận</h2>
  <div class="badge">{label}</div>
  <p>Hợp đồng <strong>{contract}</strong> đã được cập nhật trạng thái.<br>
     Dashboard sẽ phản ánh quyết định này ngay lập tức.</p>
  <a href="{pipeline_url}" class="btn">Xem phân tích chi tiết →</a>
  <div class="time">OPC FlowMind · Quyết định của Founder đã được lưu</div>
</div>
</body>
</html>"""


def _html_error(title: str, detail: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Lỗi — OPC FlowMind</title>
<style>body{{font-family:Arial,sans-serif;background:#fef2f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.card{{background:#fff;border-radius:12px;padding:40px 48px;max-width:420px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,.1);text-align:center}}
h2{{color:#c0392b;margin:0 0 12px}}p{{color:#666;font-size:15px}}</style>
</head>
<body><div class="card"><h2>❌ {title}</h2><p>{detail}</p></div></body>
</html>"""

@app.post("/set-schedule")
def set_schedule(body: dict):
    """Lưu interval lịch chạy định kỳ. Apps Script đọc từ đây qua /get-schedule."""
    interval = body.get("interval", "off")
    if interval not in _VALID_INTERVALS:
        return {"status": "error", "message": f"interval không hợp lệ: {interval}"}
    # Lưu vào in-memory (đủ dùng — Apps Script đọc khi cần)
    app.state.schedule_interval = interval
    return {"status": "ok", "interval": interval}


@app.get("/get-schedule")
def get_schedule():
    """Apps Script gọi để lấy interval hiện tại."""
    interval = getattr(app.state, "schedule_interval", "off")
    return {"interval": interval}


def _safe_float(v) -> float:
    try:
        return float(str(v).replace(",", "").replace("%", ""))
    except (ValueError, TypeError):
        return 0.0


if __name__ == "__main__":
    import uvicorn
    from config import API_HOST, API_PORT
    uvicorn.run("api:app", host=API_HOST, port=API_PORT, reload=True)
