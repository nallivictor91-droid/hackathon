-- ==============================================================================
-- PULSEFLOW AI: COMPLETE 1-CLICK SUPABASE DATABASE MIGRATION
-- Single-run, idempotent migration script for Supabase (PostgreSQL 15+)
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS & UTILITIES
-- ------------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Automatic updated_at timestamp trigger function
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
-- 7. PERFORMANCE INDEXES (Optimized for operational queries)
-- ------------------------------------------------------------------------------
create index if not exists idx_workflows_tenant on public.workflows(tenant_id, status);
create index if not exists idx_executions_workflow_created on public.executions(workflow_id, created_at desc);
create index if not exists idx_executions_status on public.executions(status);
create index if not exists idx_execution_steps_exec on public.execution_steps(execution_id, created_at asc);
create index if not exists idx_hitl_reviews_status on public.hitl_reviews(status, created_at desc);
create index if not exists idx_dispatches_workflow on public.dispatches(workflow_id, created_at desc);
create index if not exists idx_dispatches_channel on public.dispatches(channel, status);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES (Idempotent: Safe to Re-Run)
-- ------------------------------------------------------------------------------
alter table public.workflows enable row level security;
alter table public.executions enable row level security;
alter table public.execution_steps enable row level security;
alter table public.hitl_reviews enable row level security;
alter table public.dispatches enable row level security;
alter table public.telemetry_metrics enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Allow all on workflows" on public.workflows;
drop policy if exists "Allow all on executions" on public.executions;
drop policy if exists "Allow all on execution_steps" on public.execution_steps;
drop policy if exists "Allow all on hitl_reviews" on public.hitl_reviews;
drop policy if exists "Allow all on dispatches" on public.dispatches;
drop policy if exists "Allow all on telemetry_metrics" on public.telemetry_metrics;

-- Create permissive operational policies
create policy "Allow all on workflows" on public.workflows for all using (true) with check (true);
create policy "Allow all on executions" on public.executions for all using (true) with check (true);
create policy "Allow all on execution_steps" on public.execution_steps for all using (true) with check (true);
create policy "Allow all on hitl_reviews" on public.hitl_reviews for all using (true) with check (true);
create policy "Allow all on dispatches" on public.dispatches for all using (true) with check (true);
create policy "Allow all on telemetry_metrics" on public.telemetry_metrics for all using (true) with check (true);

-- ------------------------------------------------------------------------------
-- 9. SEED DATA: 3 FOUNDATIONAL ENTERPRISE WORKFLOWS (Single Run Ready)
-- ------------------------------------------------------------------------------

-- Seed Workflow 1: Enterprise Support Triage & SLA Router
insert into public.workflows (id, tenant_id, name, description, status, confidence_threshold, trigger, nodes, edges)
values (
  'wf-support-triage',
  'tenant-enterprise-01',
  'Enterprise Support Triage & SLA Router',
  'Ingests inbound customer tickets, classifies urgency and intent via Gemini, routes high-severity tickets or routes low confidence (<85%) to HITL review, and dispatches to Slack/CRM.',
  'active',
  0.85,
  '{
    "type": "webhook",
    "name": "Inbound Customer Ticket Webhook",
    "description": "Receives ticket JSON payload from Zendesk, Intercom, or Email relay",
    "config": { "webhookToken": "wh_support_live_94827", "allowedOrigins": ["*"] }
  }'::jsonb,
  '[
    {
      "id": "node-classifier",
      "name": "Intent & Urgency Classifier",
      "type": "semantic_classifier",
      "description": "Classifies ticket into domain taxonomies with sentiment and confidence score",
      "position": { "x": 250, "y": 150 },
      "config": {
        "model": "gemini-2.5-flash",
        "detectSentiment": true,
        "confidenceThreshold": 0.85,
        "categories": [
          { "id": "critical_outage", "name": "Critical SLA Outage", "description": "Production down, data loss, API unreachable", "priority": "critical" },
          { "id": "billing_dispute", "name": "Billing & Invoice Dispute", "description": "Overcharges, refund demands, subscription cancellation", "priority": "high" },
          { "id": "feature_request", "name": "Feature Request & Feedback", "description": "Enhancements, integrations, UI feedback", "priority": "low" },
          { "id": "technical_inquiry", "name": "Standard Technical Inquiry", "description": "Configuration help, documentation questions", "priority": "medium" }
        ]
      }
    },
    {
      "id": "node-extractor",
      "name": "Entity & Key Info Extractor",
      "type": "context_extraction",
      "description": "Extracts customer account ID, affected systems, sentiment, and core issue summary",
      "position": { "x": 500, "y": 150 },
      "config": {
        "model": "gemini-2.5-flash",
        "promptTemplate": "Analyze the following customer support ticket and extract key structured operational fields:\n\nTicket: {{input.ticketBody}}\nCustomer: {{input.customerEmail}}",
        "targetSchema": {
          "type": "object",
          "properties": {
            "accountId": { "type": "string" },
            "severityScore": { "type": "number" },
            "affectedService": { "type": "string" },
            "summary": { "type": "string" },
            "suggestedAction": { "type": "string" }
          },
          "required": ["accountId", "severityScore", "summary"]
        }
      }
    },
    {
      "id": "node-router",
      "name": "Multi-criteria SLA Router",
      "type": "conditional_router",
      "description": "Branches based on classified category and confidence score",
      "position": { "x": 750, "y": 150 },
      "config": {
        "evaluationMode": "first_match",
        "branches": [
          {
            "id": "branch-hitl",
            "name": "Low Confidence Guardrail",
            "conditions": [{ "field": "confidenceScore", "operator": "less_than", "value": 0.85 }],
            "targetNodeId": "node-hitl"
          },
          {
            "id": "branch-critical",
            "name": "Critical Outage Escalation",
            "conditions": [{ "field": "category", "operator": "equals", "value": "critical_outage" }],
            "targetNodeId": "node-slack-critical"
          },
          {
            "id": "branch-default",
            "name": "Standard CRM Update",
            "isDefault": true,
            "conditions": [],
            "targetNodeId": "node-crm-update"
          }
        ]
      }
    },
    {
      "id": "node-hitl",
      "name": "HITL Review Guardrail",
      "type": "hitl_review",
      "description": "Pauses pipeline execution for operator verification when model confidence < 85%",
      "position": { "x": 1000, "y": 50 },
      "config": {
        "confidenceThreshold": 0.85,
        "bypassIfConfidenceMet": true,
        "assignedRole": "Tier 2 Operations Lead",
        "timeoutHours": 2
      }
    },
    {
      "id": "node-slack-critical",
      "name": "Slack #incident-war-room Dispatcher",
      "type": "external_dispatcher",
      "description": "Sends rich block kit notification to PagerDuty/Slack incident channel",
      "position": { "x": 1000, "y": 250 },
      "config": {
        "channel": "slack",
        "destination": "#incident-war-room",
        "template": "🚨 *CRITICAL SLA OUTAGE DETECTED*\n*Account:* {{extracted.accountId}}\n*Summary:* {{extracted.summary}}\n*Severity:* {{extracted.severityScore}}/10\n*Action:* {{extracted.suggestedAction}}",
        "includeRawPayload": false,
        "includeStepTraces": true
      }
    },
    {
      "id": "node-crm-update",
      "name": "CRM Deal & Ticket Sync",
      "type": "external_dispatcher",
      "description": "Updates CRM ticket status and notes",
      "position": { "x": 1000, "y": 400 },
      "config": {
        "channel": "crm",
        "destination": "hubspot/tickets/v1",
        "template": "Ticket categorized as {{category}} (sentiment: {{sentiment}}). Summary: {{extracted.summary}}",
        "includeRawPayload": true,
        "includeStepTraces": false
      }
    }
  ]'::jsonb,
  '[
    { "id": "e1", "source": "trigger", "target": "node-classifier" },
    { "id": "e2", "source": "node-classifier", "target": "node-extractor" },
    { "id": "e3", "source": "node-extractor", "target": "node-router" },
    { "id": "e4", "source": "node-router", "target": "node-hitl", "conditionId": "branch-hitl", "label": "Confidence < 85%" },
    { "id": "e5", "source": "node-router", "target": "node-slack-critical", "conditionId": "branch-critical", "label": "Critical Outage" },
    { "id": "e6", "source": "node-router", "target": "node-crm-update", "conditionId": "branch-default", "label": "Standard Route" },
    { "id": "e7", "source": "node-hitl", "target": "node-slack-critical", "label": "On Human Approval" }
  ]'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  confidence_threshold = excluded.confidence_threshold,
  trigger = excluded.trigger,
  nodes = excluded.nodes,
  edges = excluded.edges;

-- Seed Workflow 2: Autonomous Vendor Invoice & AP Processor
insert into public.workflows (id, tenant_id, name, description, status, confidence_threshold, trigger, nodes, edges)
values (
  'wf-invoice-ap',
  'tenant-enterprise-01',
  'Autonomous Vendor Invoice & AP Processor',
  'Multimodal document pipeline extracting vendor line items, totals, and PO numbers via gemini-2.5-pro, enforcing financial compliance with HITL approval on amounts over $5,000.',
  'active',
  0.90,
  '{
    "type": "document",
    "name": "Accounts Payable Document Ingest",
    "description": "Accepts PDF, PNG, TIFF invoice uploads",
    "config": {
      "supportedMimeTypes": ["application/pdf", "image/png", "image/jpeg"],
      "maxFileSizeBytes": 15728640,
      "autoOcr": true
    }
  }'::jsonb,
  '[
    {
      "id": "node-invoice-extract",
      "name": "Gemini 2.5 Pro Multimodal Invoice Parser",
      "type": "context_extraction",
      "description": "Deep document extraction extracting vendor, line items, VAT, and total invoice amount",
      "position": { "x": 300, "y": 150 },
      "config": {
        "model": "gemini-2.5-pro",
        "promptTemplate": "Extract all financial data and line items from this invoice document with complete accounting accuracy.",
        "targetSchema": {
          "type": "object",
          "properties": {
            "vendorName": { "type": "string" },
            "invoiceNumber": { "type": "string" },
            "totalAmount": { "type": "number" },
            "currency": { "type": "string" },
            "taxAmount": { "type": "number" }
          },
          "required": ["vendorName", "invoiceNumber", "totalAmount"]
        }
      }
    },
    {
      "id": "node-amount-router",
      "name": "Finance Approval Threshold Router",
      "type": "conditional_router",
      "description": "Routes invoices > $5,000 to CFO/Finance Director for approval",
      "position": { "x": 600, "y": 150 },
      "config": {
        "evaluationMode": "first_match",
        "branches": [
          {
            "id": "branch-high-value",
            "name": "High Value (> $5,000)",
            "conditions": [{ "field": "extracted.totalAmount", "operator": "greater_than", "value": 5000 }],
            "targetNodeId": "node-finance-hitl"
          },
          {
            "id": "branch-auto-approve",
            "name": "Auto-Approve Under Limit",
            "isDefault": true,
            "conditions": [],
            "targetNodeId": "node-erp-webhook"
          }
        ]
      }
    },
    {
      "id": "node-finance-hitl",
      "name": "Finance Director HITL Approval",
      "type": "hitl_review",
      "description": "Requires human sign-off for large disbursements or low extraction confidence",
      "position": { "x": 900, "y": 80 },
      "config": {
        "confidenceThreshold": 0.90,
        "assignedRole": "Finance Director",
        "bypassIfConfidenceMet": false
      }
    },
    {
      "id": "node-erp-webhook",
      "name": "ERP / NetSuite Relay Webhook",
      "type": "external_dispatcher",
      "description": "Posts structured invoice transaction into corporate ERP",
      "position": { "x": 900, "y": 250 },
      "config": {
        "channel": "webhook",
        "destination": "https://netsuite.internal.corp/api/v2/bills",
        "template": "Invoice {{extracted.invoiceNumber}} from {{extracted.vendorName}} total {{extracted.currency}} {{extracted.totalAmount}} posted to general ledger.",
        "includeRawPayload": true,
        "includeStepTraces": true
      }
    }
  ]'::jsonb,
  '[
    { "id": "ei1", "source": "trigger", "target": "node-invoice-extract" },
    { "id": "ei2", "source": "node-invoice-extract", "target": "node-amount-router" },
    { "id": "ei3", "source": "node-amount-router", "target": "node-finance-hitl", "conditionId": "branch-high-value", "label": "Amount > $5,000" },
    { "id": "ei4", "source": "node-amount-router", "target": "node-erp-webhook", "conditionId": "branch-auto-approve", "label": "Auto-Approved" },
    { "id": "ei5", "source": "node-finance-hitl", "target": "node-erp-webhook", "label": "On Approval" }
  ]'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  confidence_threshold = excluded.confidence_threshold,
  trigger = excluded.trigger,
  nodes = excluded.nodes,
  edges = excluded.edges;

-- Seed Workflow 3: Security Anomaly & Telemetry Sentinel
insert into public.workflows (id, tenant_id, name, description, status, confidence_threshold, trigger, nodes, edges)
values (
  'wf-security-sentinel',
  'tenant-enterprise-01',
  'Security Anomaly & Telemetry Sentinel',
  'Ingests cloud telemetry and server auth logs, classifies threats via Gemini 2.5 Flash, and automatically triggers IP block webhooks and incident notifications.',
  'active',
  0.88,
  '{
    "type": "scheduled",
    "name": "Telemetry Polling Stream",
    "description": "Runs every 5 minutes against SIEM stream",
    "config": { "cronExpression": "*/5 * * * *", "timezone": "UTC" }
  }'::jsonb,
  '[
    {
      "id": "node-threat-classifier",
      "name": "Threat Level & Anomaly Classifier",
      "type": "semantic_classifier",
      "description": "Classifies telemetry patterns into benign, reconnaissance, brute force, or credential stuffing",
      "position": { "x": 300, "y": 150 },
      "config": {
        "model": "gemini-2.5-flash",
        "detectSentiment": false,
        "confidenceThreshold": 0.88,
        "categories": [
          { "id": "brute_force", "name": "Brute Force Attack", "description": "Repeated failed auth spikes from distributed IPs", "priority": "critical" },
          { "id": "privilege_escalation", "name": "Privilege Escalation Attempt", "description": "Unauthorized role assignment attempts", "priority": "critical" },
          { "id": "suspicious_traffic", "name": "Suspicious Bot Traversal", "description": "Path traversal or scraper footprint", "priority": "medium" },
          { "id": "benign_telemetry", "name": "Benign Operational Activity", "description": "Normal health checks and routine traffic", "priority": "low" }
        ]
      }
    },
    {
      "id": "node-sec-router",
      "name": "Threat Mitigation Router",
      "type": "conditional_router",
      "description": "Routes critical security threats to automated firewall block and alert",
      "position": { "x": 600, "y": 150 },
      "config": {
        "evaluationMode": "first_match",
        "branches": [
          {
            "id": "branch-critical-sec",
            "name": "Critical Attack Vector",
            "conditions": [{ "field": "category", "operator": "in", "value": ["brute_force", "privilege_escalation"] }],
            "targetNodeId": "node-sec-slack"
          },
          {
            "id": "branch-benign",
            "name": "Log and Retain",
            "isDefault": true,
            "conditions": [],
            "targetNodeId": "node-sec-log"
          }
        ]
      }
    },
    {
      "id": "node-sec-slack",
      "name": "Security Ops War Room Alert",
      "type": "external_dispatcher",
      "description": "High-priority alert to #secops-alerts",
      "position": { "x": 900, "y": 100 },
      "config": {
        "channel": "slack",
        "destination": "#secops-alerts",
        "template": "🛡️ *SECURITY THREAT MITIGATED*\n*Classification:* {{category}}\n*Confidence:* {{confidenceScore}}\n*Payload:* {{input.sourceIp}} attempted suspicious actions.",
        "includeRawPayload": true,
        "includeStepTraces": true
      }
    },
    {
      "id": "node-sec-log",
      "name": "Security Audit Relay",
      "type": "external_dispatcher",
      "description": "Relays sanitized log to long-term cold audit storage",
      "position": { "x": 900, "y": 240 },
      "config": {
        "channel": "webhook",
        "destination": "https://audit.security.internal/events",
        "template": "Audit log archived: {{category}} - {{status}}",
        "includeRawPayload": false,
        "includeStepTraces": false
      }
    }
  ]'::jsonb,
  '[
    { "id": "es1", "source": "trigger", "target": "node-threat-classifier" },
    { "id": "es2", "source": "node-threat-classifier", "target": "node-sec-router" },
    { "id": "es3", "source": "node-sec-router", "target": "node-sec-slack", "conditionId": "branch-critical-sec", "label": "Critical Threat" },
    { "id": "es4", "source": "node-sec-router", "target": "node-sec-log", "conditionId": "branch-benign", "label": "Benign Log" }
  ]'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  confidence_threshold = excluded.confidence_threshold,
  trigger = excluded.trigger,
  nodes = excluded.nodes,
  edges = excluded.edges;

-- ==============================================================================
-- SUCCESS CONFIRMATION
-- ==============================================================================
select 
  'MIGRATION COMPLETED SUCCESSFULLY' as status,
  (select count(*) from public.workflows) as total_workflows,
  current_timestamp as completed_at;
