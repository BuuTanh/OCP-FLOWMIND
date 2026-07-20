export interface Contract {
  contract_id: string;
  customer_id: string;
  description: string;
  contract_value: number;
  gross_margin: number;
  concentration_pct: number;
  status: string;
  start_date: string;
  end_date: string;
}

export interface CashflowMonth {
  month: string;
  expected_cash_in: number;
  expected_cash_out: number;
  projected_closing_cash: number;
  status: 'CRITICAL' | 'WARNING' | 'OK';
}

export interface RiskAlert {
  alert_id: string;
  rule_id: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  recommended_action: string;
  related_record: string;
}

export interface Reason {
  text: string;
  source_sheet: string;
  source_cell: string;
}

export interface BankOption {
  bank: string;
  product_name: string;
  amount_band: string;
  annual_rate: number;
  eligibility_score: number;
  fit_reason: string;
}

export type Recommendation = 'KY' | 'KY_CO_DIEU_KIEN' | 'KHONG_KY' | 'CHUA_DU_DATA' | 'CHUA_DU_DU_LIEU';

export interface DecisionCard {
  contract_id: string;
  recommendation: Recommendation;
  confidence_score: number;
  three_reasons: Reason[];
  bank_options: BankOption[];
  risk_alerts: RiskAlert[];
  approval_checklist: string[];
  preconditions: string[];
  guard_condition: string;
  confirm_button_enabled: boolean;
  confirm_button_disabled_reason: string | null;
  narrative: string;
  missing_items?: Record<string, string[]>;
}

export interface PipelineStep {
  step: number;
  agent: string;
  status: string;
  summary: string;
  has_warning: boolean;
  critical_alerts?: string;
}

export interface AnalysisResult {
  meta: { contract_id: string; generated_at: string; system: string };
  zone_input: {
    cashflow_chart: CashflowMonth[];
    receivables: { open_vnd: number; pipeline_vnd: number };
    data_confidence: string;
  };
  zone_workflow: {
    crisis_layer: { active: boolean; resolved: boolean; alert: { txn_ids: string[]; risk_scores: Record<string, number>; description: string } | null };
    pipeline: PipelineStep[];
    feedback_loop_triggered: boolean;
  };
  zone_decision: DecisionCard;
  zone_research?: ResearchResult;
  agent_logs: unknown[];
}

export interface Customer {
  customer_id: string;
  customer_name: string;
}

export interface ExtractedContract {
  customer_name: string | null;
  contract_value: number | null;
  estimated_cost: number | null;
  computed_gross_margin: number | null;
  margin_formula: string | null;
  matched_customer_id: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  payment_terms: string | null;
  missing_fields: string[];
  raw_text_preview: string;
}

export interface ConfirmContractPayload {
  contract_id: string;
  customer_id: string;
  contract_value: number;
  gross_margin: number;
  start_date: string;
  end_date: string;
  description: string;
  payment_terms: string;
  status: string;
  new_customer_name?: string;
}

export interface Notification {
  id: string;
  type: 'crisis' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export type Sentiment = 'TÍCH CỰC' | 'TRUNG LẬP' | 'TIÊU CỰC' | 'CHƯA ĐỦ DỮ LIỆU';

export interface ResearchSource {
  title: string;
  publisher: string;
  published_at: string;
  url: string;
  snippet: string;
  tone: 'tích cực' | 'trung lập' | 'tiêu cực';
}

export interface ResearchReport {
  agent: string;
  scope: 'company' | 'market';
  subject: string;
  sentiment: Sentiment;
  sentiment_score: number;
  confidence: number;
  executive_summary: string;
  positive_signals: string[];
  negative_signals: string[];
  recommended_actions: string[];
  sources: ResearchSource[];
  generated_at: string;
  report_id: string;
  is_demo: boolean;
  disclaimer: string;
  identity_status?: string;
  source_status?: string;
}

export interface ResearchResult {
  company_report: ResearchReport;
  market_report: ResearchReport;
  overall: {
    sentiment: Sentiment;
    sentiment_score: number;
    decision_support: string;
    human_review_required: boolean;
    recommendation_before_research?: Recommendation;
    recommendation_after_research?: Recommendation;
    confidence_before_research?: number;
    confidence_after_research?: number;
    confidence_adjustment?: number;
    impact_summary?: string;
  };
  methodology: string;
  is_demo: boolean;
}
