import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AnalysisResult, Notification } from '../types';

export interface RunEntry {
  id: string;
  contractId: string;
  timestamp: string;
  recommendation: string;
  confidence: number;
  alertCount: number;
  resolvedCount: number;
  // Snapshot of state at run time — used to restore historical view
  crisisResolved?: boolean;
  resolvedIds?: string[];
}

export type DecisionAction = 'KY' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG';

export interface ContractDecision {
  contractId: string;
  action: DecisionAction;
  timestamp: string;
  runId?: string;
  confidence?: number;
  recommendation?: string;
  // Từ chối
  rejectReason?: string;
  rejectNote?: string;
  // Yêu cầu bổ sung
  requestItems?: string[];
  requestNote?: string;
}

interface AppContextType {
  selectedContract: string;
  setSelectedContract: (id: string) => void;
  crisisResolved: boolean;
  setCrisisResolved: (v: boolean) => void;
  lastResult: AnalysisResult | null;
  setLastResult: (r: AnalysisResult | null) => void;
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  analysisHistory: Record<string, AnalysisResult>;
  setAnalysisHistory: React.Dispatch<React.SetStateAction<Record<string, AnalysisResult>>>;
  runLog: RunEntry[];
  addRunEntry: (entry: Omit<RunEntry, 'id'>) => string;
  runResults: Record<string, AnalysisResult>;
  addRunResult: (runId: string, result: AnalysisResult) => void;
  // Contract decisions — persisted
  contractDecisions: Record<string, ContractDecision>;
  saveDecision: (d: ContractDecision) => void;
  clearDecision: (contractId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [selectedContract, setSelectedContract] = useState('CON-001');
  const [crisisResolved, setCrisisResolved] = useState(false);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [analysisHistory, setAnalysisHistoryRaw] = useState<Record<string, AnalysisResult>>(() => {
    try { const s = localStorage.getItem('opc_analysis_history'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });

  const setAnalysisHistory = useCallback(
    (updater: React.SetStateAction<Record<string, AnalysisResult>>) => {
      setAnalysisHistoryRaw(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try { localStorage.setItem('opc_analysis_history', JSON.stringify(next)); } catch {}
        return next;
      });
    }, []
  );

  const [runLog, setRunLog] = useState<RunEntry[]>(() => {
    try { const s = localStorage.getItem('opc_run_log'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  const addRunEntry = useCallback((entry: Omit<RunEntry, 'id'>): string => {
    const id = Date.now().toString();
    setRunLog(prev => {
      const next = [{ ...entry, id }, ...prev].slice(0, 30);
      try { localStorage.setItem('opc_run_log', JSON.stringify(next)); } catch {}
      return next;
    });
    return id;
  }, []);

  const [runResults, setRunResultsRaw] = useState<Record<string, AnalysisResult>>(() => {
    try { const s = localStorage.getItem('opc_run_results'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });

  const addRunResult = useCallback((runId: string, result: AnalysisResult) => {
    setRunResultsRaw(prev => {
      const next = { ...prev, [runId]: result };
      const keys = Object.keys(next);
      if (keys.length > 20) keys.slice(0, keys.length - 20).forEach(k => delete next[k]);
      try { localStorage.setItem('opc_run_results', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // contractDecisions: one decision per contract (latest action) — persisted
  const [contractDecisions, setContractDecisions] = useState<Record<string, ContractDecision>>(() => {
    try { const s = localStorage.getItem('opc_contract_decisions'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });

  const saveDecision = useCallback((d: ContractDecision) => {
    setContractDecisions(prev => {
      const next = { ...prev, [d.contractId]: d };
      try { localStorage.setItem('opc_contract_decisions', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearDecision = useCallback((contractId: string) => {
    setContractDecisions(prev => {
      const next = { ...prev };
      delete next[contractId];
      try { localStorage.setItem('opc_contract_decisions', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{
      ...n, id: Date.now().toString(), timestamp: new Date().toISOString(), read: false,
    }, ...prev]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  return (
    <AppContext.Provider value={{
      selectedContract, setSelectedContract,
      crisisResolved, setCrisisResolved,
      lastResult, setLastResult,
      notifications, addNotification, markRead,
      isRunning, setIsRunning,
      analysisHistory, setAnalysisHistory,
      runLog, addRunEntry,
      runResults, addRunResult,
      contractDecisions, saveDecision, clearDecision,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
