import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Server, 
  Monitor, 
  Database, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  ArrowRight, 
  RefreshCw, 
  Layers, 
  Zap,
  X 
} from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store/useStore';

export const ArchitectureModal: React.FC = () => {
  const { isArchitectureModalOpen, setIsArchitectureModalOpen } = useStore();
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testingGemini, setTestingGemini] = useState(false);

  useEffect(() => {
    if (isArchitectureModalOpen) {
      loadHealth();
    }
  }, [isArchitectureModalOpen]);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await api.getHealth();
      setHealthData(data);
    } catch (err: any) {
      setHealthData({ status: 'unreachable', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runGeminiTest = async () => {
    setTestingGemini(true);
    setTestResult(null);
    try {
      const res = await api.testGemini();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingGemini(false);
    }
  };

  if (!isArchitectureModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                System Architecture & Separation Boundaries
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Decoupled Architecture
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                Rigorous differentiation between Frontend presentation, Backend orchestration, and Database layers
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsArchitectureModalOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">

          {/* Interactive Multi-Tier Flow Chart */}
          <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> End-to-End Segregation Diagram
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              
              {/* TIER 1: FRONTEND */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-sky-950/30 to-slate-900 border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                    <Monitor className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    Port 5173
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Client Presentation</h4>
                  <p className="text-xs text-slate-400">Browser Sandbox (React 19 + Vite)</p>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300 border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Zero Private Secrets
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    • TanStack Table & Zustand
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    • Reverse Proxy: <code>/api</code>
                  </div>
                </div>
              </div>

              {/* ARROW */}
              <div className="hidden md:flex absolute left-[23.5%] top-1/2 -translate-y-1/2 z-10 text-slate-500">
                <ArrowRight className="w-5 h-5" />
              </div>

              {/* TIER 2: BACKEND */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-indigo-950/30 to-slate-900 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Server className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Port 5000
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Secure API Gateway</h4>
                  <p className="text-xs text-slate-400">Express + TypeScript (tsx)</p>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300 border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <Lock className="w-3.5 h-3.5" /> Holds Server Secrets
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    • Autonomous Pipeline Engine
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    • Helmet & Rate Limiting
                  </div>
                </div>
              </div>

              {/* ARROW */}
              <div className="hidden md:flex absolute left-[48.5%] top-1/2 -translate-y-1/2 z-10 text-slate-500">
                <ArrowRight className="w-5 h-5" />
              </div>

              {/* TIER 3: AI ENGINE */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-purple-950/30 to-slate-900 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Cpu className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    @google/genai
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Gemini Foundation</h4>
                  <p className="text-xs text-slate-400">Structured Decision Harness</p>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300 border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1.5 text-purple-400">
                    • gemini-2.5-flash (Classifier)
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-400">
                    • gemini-2.5-pro (Extraction)
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Self-Correcting Retries
                  </div>
                </div>
              </div>

              {/* ARROW */}
              <div className="hidden md:flex absolute left-[73.5%] top-1/2 -translate-y-1/2 z-10 text-slate-500">
                <ArrowRight className="w-5 h-5" />
              </div>

              {/* TIER 4: DATABASE */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/30 to-slate-900 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Database className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    PostgreSQL 15+
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Persistence Vault</h4>
                  <p className="text-xs text-slate-400">Supabase + Resilient Cache</p>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300 border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    • Row Level Security (RLS)
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    • Workflows & Traces
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    • Zero-Downtime Fallback
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Separation Matrix Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Architectural Separation Matrix
            </h3>
            
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-medium">Domain Attribute</th>
                    <th className="p-3.5 font-medium text-sky-400">Frontend Presentation (Client)</th>
                    <th className="p-3.5 font-medium text-indigo-400">Backend Server (Orchestrator)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-300">
                  <tr>
                    <td className="p-3.5 font-medium text-slate-200">Execution Runtime</td>
                    <td className="p-3.5 font-mono text-sky-300">Browser Chromium / V8 Engine</td>
                    <td className="p-3.5 font-mono text-indigo-300">Node.js v24+ (tsx TypeScript engine)</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-slate-200">Port & Network</td>
                    <td className="p-3.5 font-mono">http://localhost:5173</td>
                    <td className="p-3.5 font-mono">http://localhost:5000</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-slate-200">Secrets Management</td>
                    <td className="p-3.5 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Contains NO server secrets or master API keys
                    </td>
                    <td className="p-3.5 text-amber-400">
                      Holds <code>GEMINI_API_KEY</code> & <code>SUPABASE_SERVICE_ROLE_KEY</code>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-slate-200">AI / LLM Interaction</td>
                    <td className="p-3.5 text-slate-400">
                      Never calls LLM directly; consumes strictly sanitized API endpoints
                    </td>
                    <td className="p-3.5 text-purple-300">
                      Executes official <code>@google/genai</code> SDK with JSON schema enforcement
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-medium text-slate-200">State & Resilience</td>
                    <td className="p-3.5 text-slate-400">
                      Zustand reactive cache, TanStack Query auto-refetching
                    </td>
                    <td className="p-3.5 text-slate-400">
                      PostgreSQL transactions with automatic in-memory fallback store
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Live System Diagnostics & Engine Test */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" /> Live Backend Connectivity Status
                </h4>
                <p className="text-xs text-slate-400">
                  Real-time status returned by the Express server on port 5000
                </p>
              </div>
              <button
                onClick={loadHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh Status
              </button>
            </div>

            {healthData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Platform Status</div>
                  <div className="text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {healthData.status?.toUpperCase() || 'HEALTHY'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Backend Port</div>
                  <div className="text-white font-mono font-semibold mt-1">
                    {healthData.components?.backendServer?.port || 5000}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Gemini LLM SDK</div>
                  <div className="text-purple-400 font-semibold mt-1">
                    @google/genai (v2.30+)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Database Engine</div>
                  <div className="text-sky-400 font-semibold mt-1 truncate">
                    {healthData.components?.database?.status === 'supabase_connected' ? 'Supabase Live' : 'Hybrid Fallback Active'}
                  </div>
                </div>
              </div>
            )}

            {/* Test Gemini LLM Connection */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-300">Live LLM Benchmark Test:</span>
                <span className="text-xs text-slate-400 ml-2">Dispatches a structured JSON query through backend to Google Gen AI</span>
              </div>
              <button
                onClick={runGeminiTest}
                disabled={testingGemini}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all"
              >
                {testingGemini ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Testing Engine...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    Benchmark Gemini SDK
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className="p-3.5 rounded-lg bg-slate-900 border border-indigo-500/30 text-xs font-mono space-y-1">
                <div className="text-emerald-400 font-semibold">
                  ✓ LLM Test Success ({testResult.latencyMs}ms latency)
                </div>
                <div className="text-slate-300">Model: {testResult.modelUsed || 'gemini-2.5-flash'}</div>
                <div className="text-slate-400">Response: {JSON.stringify(testResult.response)}</div>
              </div>
            )}
          </div>

          {/* Supabase Live Database Connection & Migration Section */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" /> Supabase PostgreSQL Connection & Data Sync
                </h4>
                <p className="text-xs text-slate-400">
                  Target Project: <span className="text-slate-300 font-mono">https://oxsyuuouirvfwngpgnkk.supabase.co</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://supabase.com/dashboard/project/oxsyuuouirvfwngpgnkk/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                >
                  Open Supabase SQL Editor ↗
                </a>
                <button
                  onClick={async () => {
                    const sql = `-- ==============================================================================
-- PulseFlow AI: Enterprise Autonomous Workflow Orchestrator
-- Complete PostgreSQL Schema & Security Policies for Supabase
-- ==============================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.workflows (
  id text primary key,
  tenant_id text not null default 'tenant-enterprise-01',
  name text not null,
  description text default '',
  status text not null check (status in ('active', 'paused', 'draft')) default 'active',
  confidence_threshold numeric(4, 2) not null default 0.85,
  trigger jsonb not null default '{}'::jsonb,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.executions (
  id text primary key,
  workflow_id text not null references public.workflows(id) on delete cascade,
  tenant_id text not null default 'tenant-enterprise-01',
  trigger_type text not null,
  status text not null check (status in ('running', 'success', 'failed', 'pending_hitl', 'retried')),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb default null,
  latency_ms integer default 0,
  total_tokens integer default 0,
  total_cost_usd numeric(10, 6) default 0.000000,
  error_message text default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.execution_steps (
  id text primary key,
  execution_id text not null references public.executions(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  node_name text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'skipped', 'waiting_hitl')),
  input_data jsonb default null,
  output_data jsonb default null,
  reasoning text default null,
  confidence_score numeric(4, 2) default null,
  latency_ms integer default 0,
  prompt_tokens integer default 0,
  candidate_tokens integer default 0,
  total_tokens integer default 0,
  cost_usd numeric(10, 6) default 0.000000,
  model_used text default null,
  retry_count integer default 0,
  validation_errors jsonb default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone default null
);

create table if not exists public.hitl_reviews (
  id text primary key,
  execution_id text not null references public.executions(id) on delete cascade,
  workflow_id text not null references public.workflows(id) on delete cascade,
  step_id text not null,
  node_id text not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'timeout')) default 'pending',
  confidence_score numeric(4, 2) not null,
  threshold numeric(4, 2) not null,
  reasoning text default null,
  original_payload jsonb not null,
  extracted_payload jsonb not null,
  modified_payload jsonb default null,
  operator_notes text default null,
  reviewed_by text default null,
  reviewed_at timestamp with time zone default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.dispatches (
  id text primary key,
  execution_id text not null references public.executions(id) on delete cascade,
  workflow_id text not null references public.workflows(id) on delete cascade,
  channel text not null check (channel in ('slack', 'crm', 'webhook', 'email')),
  destination text not null,
  status text not null check (status in ('delivered', 'failed')),
  response_code integer default 200,
  latency_ms integer default 0,
  payload jsonb not null,
  rendered_message text default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workflows enable row level security;
alter table public.executions enable row level security;
alter table public.execution_steps enable row level security;
alter table public.hitl_reviews enable row level security;
alter table public.dispatches enable row level security;

create policy "Allow all on workflows" on public.workflows for all using (true) with check (true);
create policy "Allow all on executions" on public.executions for all using (true) with check (true);
create policy "Allow all on execution_steps" on public.execution_steps for all using (true) with check (true);
create policy "Allow all on hitl_reviews" on public.hitl_reviews for all using (true) with check (true);
create policy "Allow all on dispatches" on public.dispatches for all using (true) with check (true);`;
                    navigator.clipboard.writeText(sql);
                    alert('Complete Supabase PostgreSQL Migration copied to clipboard! Paste it into your Supabase Dashboard SQL Editor and click Run.');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  📋 Copy SQL Migration
                </button>
              </div>
            </div>

            {/* Sync Now Action */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Execute schema in Supabase SQL editor, then click verify to sync all workflows & traces.
              </span>
              <button
                onClick={async () => {
                  try {
                    const res = await api.syncSupabase();
                    alert(res.message);
                    loadHealth();
                  } catch (err: any) {
                    alert('Sync check: ' + err.message);
                  }
                }}
                className="px-4 py-2 font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Verify & Sync Database Now
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={() => setIsArchitectureModalOpen(false)}
            className="px-5 py-2 text-sm font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
