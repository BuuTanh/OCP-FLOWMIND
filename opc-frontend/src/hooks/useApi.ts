import axios from 'axios';
import type { AnalysisResult, Contract, CashflowMonth, RiskAlert } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({ baseURL: API_BASE, timeout: 120000 });

export function useApi() {
  async function runAnalysis(contractId: string, crisisResolved: boolean, resolvedItems: string[] = []): Promise<AnalysisResult> {
    const { data } = await client.post('/analyze', {
      contract_id: contractId,
      crisis_resolved: crisisResolved,
      resolved_items: resolvedItems,
    });
    return data;
  }

  async function getContracts(): Promise<Contract[]> {
    const { data } = await client.get('/contracts');
    return data;
  }

  async function getCashflow(contractId?: string): Promise<CashflowMonth[]> {
    const params = contractId ? { contract_id: contractId } : {};
    const { data } = await client.get('/cashflow', { params });
    return data;
  }

  async function getAlerts(): Promise<RiskAlert[]> {
    const { data } = await client.get('/alerts');
    return data;
  }

  function getSheetId(): string {
    return localStorage.getItem('gsheet_id') || '';
  }

  function getApiKey(): string {
    return localStorage.getItem('openai_key') || '';
  }

  async function reloadCache(): Promise<void> {
    await client.post('/memory/invalidate');
  }

  return { runAnalysis, getContracts, getCashflow, getAlerts, getSheetId, getApiKey, reloadCache };
}
