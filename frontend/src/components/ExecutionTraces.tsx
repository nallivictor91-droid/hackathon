import React, { useEffect, useState } from 'react';
import { 
  ListTree, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Coins, 
  Cpu, 
  ArrowRight, 
  Filter, 
  RefreshCw, 
  Eye, 
  FileCode, 
  Copy, 
  Check, 
  Layers,
  X 
} from 'lucide-react';
import { api } from '../api/client';
import { ExecutionRun, StepTrace } from '../types';
import { useStore } from '../store/useStore';

export const ExecutionTraces: React.FC = () => {
  const { selectedExecution, setSelectedExecution } = useStore();
  const [executions, setExecutions] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const data = await api.getExecutions(statusFilter);
      setExecutions(data);
      if (data.length > 0 && !selectedExecution) {
        setSelectedExecution(data[0]);
      }
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
  }, [statusFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Success
          </span>
        );
      case 'pending_hitl':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Pending HITL
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Running
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Execution Traces & Waterfall Telemetry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deep step-by-step latency inspection, token consumption metrics, self-correction retry logs, and payload diffs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {['all', 'success', 'pending_hitl', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={loadExecutions}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Executions Table + Detailed Trace Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Execution Runs Table (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Historical Executions ({executions.length})
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {executions.map((exec) => {
              const isSelected = selectedExecution?.id === exec.id;
              return (
                <div
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-300">
                      {exec.id}
                    </span>
                    {getStatusBadge(exec.status)}
                  </div>

                  <div className="text-xs text-white font-semibold mt-2 line-clamp-1">
                    {exec.workflowName}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {exec.latencyMs}ms
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Cpu className="w-3.5 h-3.5 text-purple-400" />
                      {exec.totalTokens} tokens
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(exec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Step-by-Step Waterfall & Deep Payload Inspector (7 cols) */}
        <div className="lg:col-span-7">
          {selectedExecution ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
              
              {/* Trace Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">
                      {selectedExecution.id}
                    </span>
                    {getStatusBadge(selectedExecution.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Workflow: <strong className="text-slate-300">{selectedExecution.workflowName}</strong> • Trigger: <span className="font-mono text-slate-300">{selectedExecution.triggerType}</span>
                  </p>
                </div>

                {/* KPI chips */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                    <span className="text-slate-400">Latency: </span>
                    <strong className="text-cyan-400">{selectedExecution.latencyMs}ms</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                    <span className="text-slate-400">Cost: </span>
                    <strong className="text-emerald-400">${selectedExecution.totalCostUsd?.toFixed(5) || '0.00010'}</strong>
                  </div>
                </div>
              </div>

              {/* Waterfall Steps Visualizer */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ListTree className="w-4 h-4 text-indigo-400" />
                  Step-by-Step Execution Waterfall ({selectedExecution.steps.length} Steps)
                </h4>

                <div className="space-y-3">
                  {selectedExecution.steps.map((step, idx) => (
                    <div 
                      key={step.id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-white">
                              {step.nodeName}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              {step.nodeType}
                            </span>
                          </div>
                          {step.reasoning && (
                            <p className="text-xs text-slate-400 mt-1 pl-7">
                              {step.reasoning}
                            </p>
                          )}
                        </div>

                        <div className="text-right font-mono text-xs">
                          <div className="text-cyan-400">{step.latencyMs}ms</div>
                          {step.totalTokens > 0 && (
                            <div className="text-slate-500 text-[10px]">{step.totalTokens} tokens</div>
                          )}
                        </div>
                      </div>

                      {/* Model & Retry Badges */}
                      <div className="pl-7 flex items-center gap-2 text-[10px] font-mono">
                        {step.modelUsed && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            Model: {step.modelUsed}
                          </span>
                        )}
                        {step.confidenceScore !== undefined && (
                          <span className={`px-2 py-0.5 rounded border ${
                            step.confidenceScore >= 0.85 
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}>
                            Confidence: {(step.confidenceScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {step.retryCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Self-Correcting Retries: {step.retryCount}
                          </span>
                        )}
                      </div>

                      {/* Step Output Payload JSON */}
                      {step.outputData && (
                        <div className="pl-7 pt-2">
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-40">
                            <pre>{JSON.stringify(step.outputData, null, 2)}</pre>
                          </div>
                        </div>
                      )}

                      {/* Validation Errors If Retried */}
                      {step.validationErrors && step.validationErrors.length > 0 && (
                        <div className="pl-7 pt-1">
                          <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-[11px] text-rose-300 font-mono">
                            <strong>Validation Feedback Loop:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {step.validationErrors.map((err, eidx) => (
                                <li key={eidx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Inbound Input Payload */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    Raw Ingested Trigger Payload
                  </h4>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedExecution.inputPayload, null, 2), 'input')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    {copiedId === 'input' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === 'input' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
                  <pre>{JSON.stringify(selectedExecution.inputPayload, null, 2)}</pre>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              Select an execution run to inspect its step-by-step waterfall trace.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
