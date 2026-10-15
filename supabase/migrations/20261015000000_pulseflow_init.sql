-- ==============================================================================
-- PULSEFLOW AI: SUPABASE MIGRATION 20261015000000_pulseflow_init.sql
-- Single-run, idempotent migration script for Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS & UTILITIES
-- ------------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------------------------
-- 1. WORKFLOWS TABLE
-- ------------------------------------------------------------------------------
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

drop trigger if exists set_workflows_updated_at on public.workflows;
create trigger set_workflows_updated_at
  before update on public.workflows
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. EXECUTIONS TABLE (References Workflows)
-- ------------------------------------------------------------------------------
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

drop trigger if exists set_executions_updated_at on public.executions;
create trigger set_executions_updated_at
  before update on public.executions
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. EXECUTION STEPS TRACE TABLE (References Executions)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. HUMAN-IN-THE-LOOP (HITL) REVIEWS TABLE (References Executions & Workflows)
-- ------------------------------------------------------------------------------
create table if not exists public.hitl_reviews (
  id text primary key,
  execution_id text not null references public.executions(id) on delete cascade,
  workflow_id text not null references public.workflows(id) on delete cascade,
  step_id text not null,
  node_id text not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'timeout')) default 'pending',
  confidence_score numeric(4, 2) not null default 0.00,
  threshold numeric(4, 2) not null default 0.85,
  reasoning text default null,
  original_payload jsonb not null default '{}'::jsonb,
  extracted_payload jsonb not null default '{}'::jsonb,
  modified_payload jsonb default null,
  operator_notes text default null,
  reviewed_by text default null,
  reviewed_at timestamp with time zone default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------------------------
-- 5. EXTERNAL DISPATCHES AUDIT TABLE (References Executions & Workflows)
-- ------------------------------------------------------------------------------
create table if not exists public.dispatches (
  id text primary key,
  execution_id text not null references public.executions(id) on delete cascade,
  workflow_id text not null references public.workflows(id) on delete cascade,
  channel text not null check (channel in ('slack', 'crm', 'webhook', 'email')),
  destination text not null,
  status text not null check (status in ('delivered', 'failed')),
  response_code integer default 200,
  latency_ms integer default 0,
  payload jsonb not null default '{}'::jsonb,
  rendered_message text default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------------------------
-- 6. TELEMETRY & SYSTEM METRICS SUMMARY TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.telemetry_metrics (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null default 'tenant-enterprise-01',
  metric_date date not null default current_date,
  total_runs integer default 0,
  successful_runs integer default 0,
  failed_runs integer default 0,
  hitl_runs integer default 0,
  avg_latency_ms integer default 0,
  total_tokens integer default 0,
  estimated_cost_usd numeric(10, 6) default 0.000000,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tenant_id, metric_date)
);

-- ------------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
create index if not exists idx_workflows_tenant on public.workflows(tenant_id, status);
create index if not exists idx_executions_workflow_created on public.executions(workflow_id, created_at desc);
create index if not exists idx_executions_status on public.executions(status);
create index if not exists idx_execution_steps_exec on public.execution_steps(execution_id, created_at asc);
create index if not exists idx_hitl_reviews_status on public.hitl_reviews(status, created_at desc);
create index if not exists idx_dispatches_workflow on public.dispatches(workflow_id, created_at desc);
create index if not exists idx_dispatches_channel on public.dispatches(channel, status);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES (Idempotent)
-- ------------------------------------------------------------------------------
alter table public.workflows enable row level security;
alter table public.executions enable row level security;
alter table public.execution_steps enable row level security;
alter table public.hitl_reviews enable row level security;
alter table public.dispatches enable row level security;
alter table public.telemetry_metrics enable row level security;

drop policy if exists "Allow all on workflows" on public.workflows;
drop policy if exists "Allow all on executions" on public.executions;
drop policy if exists "Allow all on execution_steps" on public.execution_steps;
drop policy if exists "Allow all on hitl_reviews" on public.hitl_reviews;
drop policy if exists "Allow all on dispatches" on public.dispatches;
drop policy if exists "Allow all on telemetry_metrics" on public.telemetry_metrics;

create policy "Allow all on workflows" on public.workflows for all using (true) with check (true);
create policy "Allow all on executions" on public.executions for all using (true) with check (true);
create policy "Allow all on execution_steps" on public.execution_steps for all using (true) with check (true);
create policy "Allow all on hitl_reviews" on public.hitl_reviews for all using (true) with check (true);
create policy "Allow all on dispatches" on public.dispatches for all using (true) with check (true);
create policy "Allow all on telemetry_metrics" on public.telemetry_metrics for all using (true) with check (true);
