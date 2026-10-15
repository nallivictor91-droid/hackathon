import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  Coins, 
  CheckCircle, 
  AlertOctagon, 
  ShieldAlert, 
  Cpu, 
  RefreshCw, 
  Radio, 
  ArrowUpRight 
} from 'lucide-react';
import { api } from '../api/client';
import { TelemetryMetrics } from '../types';
import { useStore } from '../store/useStore';

export const Dashboard: React.FC = () => {
  const { setActiveTab } = useStore();
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      const data = await api.getTelemetryStats();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch telemetry metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);

    // Live Server-Sent Events (SSE) Stream
    const eventSource = new EventSource('/api/telemetry/stream');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'execution_update') {
          // Refresh metrics immediately on execution update
          fetchMetrics();
        }
      } catch (err) {
        // Heartbeat or unparsed message
      }
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Title & Telemetry Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Autonomous Pipeline Telemetry
            </h1>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Telemetry Stream
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time execution performance, token spend accountability, failure heatmaps, and HITL guardrail metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Executions */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Ingested Executions</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">
              {metrics ? metrics.totalExecutions : '—'}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              100% autonomous
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Across {metrics?.activeWorkflowsCount ?? 3} active enterprise pipelines
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Success Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">
              {metrics ? `${metrics.successRatePercentage}%` : '—'}
            </span>
            <span className="text-xs text-slate-400">
              {metrics ? `${metrics.successfulExecutions} ok / ${metrics.failedExecutions} failed` : ''}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${metrics?.successRatePercentage || 90}%` }}
            ></div>
          </div>
        </div>

        {/* Mean Time to Execution (MTTE) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Mean Time to Execution (MTTE)</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">
              {metrics ? `${(metrics.meanTimeToExecutionMs / 1000).toFixed(2)}s` : '—'}
            </span>
            <span className="text-xs font-mono text-cyan-400">
              {metrics ? `${metrics.meanTimeToExecutionMs} ms` : ''}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Average multi-node pipeline latency
          </div>
        </div>

        {/* Token Spend Accountability */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Spend & Tokens</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">
              {metrics ? `$${metrics.totalCostUsd.toFixed(4)}` : '—'}
            </span>
            <span className="text-xs font-mono text-purple-300">
              {metrics ? `${(metrics.totalTokensConsumed / 1000).toFixed(1)}k tokens` : ''}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Gemini 2.5 Flash & Pro consumption
          </div>
        </div>

      </div>

      {/* Two Column Grid: Failure Heatmap + Model / HITL Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Failure Heatmap (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                Execution Health & Failure Heatmap
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Distribution of pipeline runs across hour intervals and days of the week
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></span>
                <span className="text-slate-400">Successful</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500/40 border border-rose-500"></span>
                <span className="text-slate-400">Failed / Retried</span>
              </div>
            </div>
          </div>

          {/* Matrix Visualizer */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="grid grid-cols-8 gap-2">
              {/* Header: Hour labels */}
              <div className="text-[10px] font-mono text-slate-500 text-center">Day</div>
              {['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h'].map(h => (
                <div key={h} className="text-[10px] font-mono text-slate-400 text-center">{h}</div>
              ))}

              {/* Rows: Days */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <React.Fragment key={day}>
                  <div className="text-xs font-mono font-medium text-slate-400 flex items-center justify-center">
                    {day}
                  </div>
                  {[0, 3, 6, 9, 12, 15, 18, 21].map(hour => {
                    const entry = metrics?.failureHeatmap.find(e => e.day === day && e.hour === hour);
                    const failures = entry?.failures || 0;
                    const successes = entry?.successes || 0;
                    const hasRuns = failures > 0 || successes > 0;

                    let bgClass = 'bg-slate-800/40 border-slate-800';
                    if (failures > 0) bgClass = 'bg-rose-500/40 border-rose-500/60 text-rose-200';
                    else if (successes > 0) bgClass = 'bg-emerald-500/25 border-emerald-500/40 text-emerald-200';

                    return (
                      <div
                        key={`${day}-${hour}`}
                        title={`${day} @ ${hour}:00 - ${successes} Success, ${failures} Failures`}
                        className={`h-8 rounded-lg border flex items-center justify-center text-[10px] font-mono cursor-pointer transition-transform hover:scale-105 ${bgClass}`}
                      >
                        {hasRuns ? (failures > 0 ? `!${failures}` : `${successes}`) : '·'}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Model Distribution & HITL Status (1 col) */}
        <div className="space-y-6">
          
          {/* HITL Guardrail Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/20 to-slate-900 border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <ShieldAlert className="w-5 h-5" />
                HITL Guardrail Queue
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {metrics?.pendingHitlExecutions ?? 0} Pending
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Low-confidence LLM executions (&lt; 0.85 threshold) are safely paused for operator diff review and approval.
            </p>
            <button
              onClick={() => setActiveTab('hitl')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
            >
              Open Review Inbox
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Model Consumption Split */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              Gemini Model Utilization
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-mono">gemini-2.5-flash (Classifier/Router)</span>
                  <span className="text-slate-400 font-mono">
                    {metrics?.modelDistribution['gemini-2.5-flash'] || 12} calls
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-mono">gemini-2.5-pro (Deep Extraction)</span>
                  <span className="text-slate-400 font-mono">
                    {metrics?.modelDistribution['gemini-2.5-pro'] || 4} calls
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Real-time Activity Log */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            Real-Time Operational Audit Feed
          </h3>
          <span className="text-xs text-slate-500">Streaming execution events</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
            metrics.recentActivity.map((act, i) => (
              <div key={i} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    act.status === 'success' ? 'bg-emerald-400' : act.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                  }`} />
                  <span className="text-slate-200">{act.message}</span>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">
                  {new Date(act.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-slate-500">
              No recent activity recorded. Run a simulation in Testing Studio.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
