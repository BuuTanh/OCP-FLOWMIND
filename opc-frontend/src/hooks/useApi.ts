import axios from 'axios';
import type { AnalysisResult, Contract, CashflowMonth, RiskAlert, Customer, ExtractedContract, ConfirmContractPayload } from '../types';

// API_BASE is injected at build time by Vite from VITE_API_URL env var
const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const client = axios.create({ baseURL: API_BASE, timeout: 180000 });

export function useApi() {
  async function runAnalysis(contractId: string, crisisResolved: boolean, resolvedItems: string[] = [], resolvedCreditItems: string[] = []): Promise<AnalysisResult> {
    const { data } = await client.post('/analyze', {
      contract_id: contractId,
      crisis_resolved: crisisResolved,
      resolved_items: resolvedItems,
      resolved_credit_items: resolvedCreditItems,
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

  async function getReceivables(): Promise<{ open_vnd: number; pipeline_vnd: number }> {
    const { data } = await client.get('/receivables');
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

  async function getCustomers(): Promise<Customer[]> {
    const { data } = await client.get('/customers');
    return data;
  }

  async function nextContractId(): Promise<string> {
    const { data } = await client.get('/next-contract-id');
    return data.contract_id;
  }

  async function nextCustomerId(): Promise<string> {
    const { data } = await client.get('/next-customer-id');
    return data.customer_id;
  }

  async function extractContract(file: File): Promise<ExtractedContract> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await client.post('/extract-contract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function confirmContract(payload: ConfirmContractPayload): Promise<AnalysisResult> {
    const { data } = await client.post('/confirm-contract', payload);
    return data;
  }

  return {
    runAnalysis, getContracts, getCashflow, getAlerts, getReceivables,
    getSheetId, getApiKey, reloadCache, getCustomers, extractContract, confirmContract,
    nextContractId, nextCustomerId,
  };
}
