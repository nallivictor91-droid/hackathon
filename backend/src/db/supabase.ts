import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { 
  Workflow, 
  ExecutionRun, 
  StepTrace, 
  HitlReviewItem, 
  ExternalDispatchLog, 
  TelemetryMetrics 
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export let supabase: SupabaseClient | null = null;
let isSupabaseOnline = false;

if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('xxxxxxxxxxxx')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    console.log(`[Supabase] Initialized client for ${SUPABASE_URL}`);
  } catch (err: any) {
    console.warn(`[Supabase] Initialization error:`, err.message);
  }
}

// In-Memory Hybrid Storage (Acts as cache and reliable fallback if Supabase tables aren't migrated)
class Store {
  workflows: Map<string, Workflow> = new Map();
  executions: Map<string, ExecutionRun> = new Map();
  hitlReviews: Map<string, HitlReviewItem> = new Map();
  dispatches: ExternalDispatchLog[] = [];

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    // 1. Enterprise Support Triage & SLA Router
    const supportWorkflow: Workflow = {
      id: 'wf-support-triage',
      tenantId: 'tenant-enterprise-01',
      name: 'Enterprise Support Triage & SLA Router',
      description: 'Ingests inbound customer tickets, classifies urgency and intent via Gemini, routes high-severity tickets or routes low confidence (<85%) to HITL review, and dispatches to Slack/CRM.',
      status: 'active',
      confidenceThreshold: 0.85,
      trigger: {
        type: 'webhook',
        name: 'Inbound Customer Ticket Webhook',
        description: 'Receives ticket JSON payload from Zendesk, Intercom, or Email relay',
        config: {
          webhookToken: 'wh_support_live_94827',
          allowedOrigins: ['*'],
        },
      },
      nodes: [
        {
          id: 'node-classifier',
          name: 'Intent & Urgency Classifier',
          type: 'semantic_classifier',
          description: 'Classifies ticket into domain taxonomies with sentiment and confidence score',
          position: { x: 250, y: 150 },
          config: {
            model: 'gemini-2.5-flash',
            detectSentiment: true,
            confidenceThreshold: 0.85,
            categories: [
              { id: 'critical_outage', name: 'Critical SLA Outage', description: 'Production down, data loss, API unreachable', priority: 'critical' },
              { id: 'billing_dispute', name: 'Billing & Invoice Dispute', description: 'Overcharges, refund demands, subscription cancellation', priority: 'high' },
              { id: 'feature_request', name: 'Feature Request & Feedback', description: 'Enhancements, integrations, UI feedback', priority: 'low' },
              { id: 'technical_inquiry', name: 'Standard Technical Inquiry', description: 'Configuration help, documentation questions', priority: 'medium' },
            ],
          },
        },
        {
          id: 'node-extractor',
          name: 'Entity & Key Info Extractor',
          type: 'context_extraction',
          description: 'Extracts customer account ID, affected systems, sentiment, and core issue summary',
          position: { x: 500, y: 150 },
          config: {
            model: 'gemini-2.5-flash',
            promptTemplate: 'Analyze the following customer support ticket and extract key structured operational fields:\n\nTicket: {{input.ticketBody}}\nCustomer: {{input.customerEmail}}',
            targetSchema: {
              type: 'object',
              properties: {
                accountId: { type: 'string', description: 'Identified account or organization name' },
                severityScore: { type: 'number', description: 'Severity scale from 1 to 10' },
                affectedService: { type: 'string', description: 'Service or endpoint mentioned' },
                summary: { type: 'string', description: 'One-sentence concise operational summary' },
                suggestedAction: { type: 'string', description: 'Immediate next step recommendation' },
              },
              required: ['accountId', 'severityScore', 'summary'],
            },
          },
        },
        {
          id: 'node-router',
          name: 'Multi-criteria SLA Router',
          type: 'conditional_router',
          description: 'Branches based on classified category and confidence score',
          position: { x: 750, y: 150 },
          config: {
            evaluationMode: 'first_match',
            branches: [
              {
                id: 'branch-hitl',
                name: 'Low Confidence Guardrail',
                conditions: [
                  { field: 'confidenceScore', operator: 'less_than', value: 0.85 },
                ],
                targetNodeId: 'node-hitl',
              },
              {
                id: 'branch-critical',
                name: 'Critical Outage Escalation',
                conditions: [
                  { field: 'category', operator: 'equals', value: 'critical_outage' },
                ],
                targetNodeId: 'node-slack-critical',
              },
              {
                id: 'branch-default',
                name: 'Standard CRM Update',
                isDefault: true,
                conditions: [],
                targetNodeId: 'node-crm-update',
              },
            ],
          },
        },
        {
          id: 'node-hitl',
          name: 'HITL Review Guardrail',
          type: 'hitl_review',
          description: 'Pauses pipeline execution for operator verification when model confidence < 85%',
          position: { x: 1000, y: 50 },
          config: {
            confidenceThreshold: 0.85,
            bypassIfConfidenceMet: true,
            assignedRole: 'Tier 2 Operations Lead',
            timeoutHours: 2,
          },
        },
        {
          id: 'node-slack-critical',
          name: 'Slack #incident-war-room Dispatcher',
          type: 'external_dispatcher',
          description: 'Sends rich block kit notification to PagerDuty/Slack incident channel',
          position: { x: 1000, y: 250 },
          config: {
            channel: 'slack',
            destination: '#incident-war-room',
            template: '🚨 *CRITICAL SLA OUTAGE DETECTED*\n*Account:* {{extracted.accountId}}\n*Summary:* {{extracted.summary}}\n*Severity:* {{extracted.severityScore}}/10\n*Action:* {{extracted.suggestedAction}}',
            includeRawPayload: false,
            includeStepTraces: true,
          },
        },
        {
          id: 'node-crm-update',
          name: 'CRM Deal & Ticket Sync',
          type: 'external_dispatcher',
          description: 'Updates CRM ticket status and notes',
          position: { x: 1000, y: 400 },
          config: {
            channel: 'crm',
            destination: 'hubspot/tickets/v1',
            template: 'Ticket categorized as {{category}} (sentiment: {{sentiment}}). Summary: {{extracted.summary}}',
            includeRawPayload: true,
            includeStepTraces: false,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'node-classifier' },
        { id: 'e2', source: 'node-classifier', target: 'node-extractor' },
        { id: 'e3', source: 'node-extractor', target: 'node-router' },
        { id: 'e4', source: 'node-router', target: 'node-hitl', conditionId: 'branch-hitl', label: 'Confidence < 85%' },
        { id: 'e5', source: 'node-router', target: 'node-slack-critical', conditionId: 'branch-critical', label: 'Critical Outage' },
        { id: 'e6', source: 'node-router', target: 'node-crm-update', conditionId: 'branch-default', label: 'Standard Route' },
        { id: 'e7', source: 'node-hitl', target: 'node-slack-critical', label: 'On Human Approval' },
      ],
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. Autonomous Vendor Invoice & AP Processor
    const invoiceWorkflow: Workflow = {
      id: 'wf-invoice-ap',
      tenantId: 'tenant-enterprise-01',
      name: 'Autonomous Vendor Invoice & AP Processor',
      description: 'Multimodal document pipeline extracting vendor line items, totals, and PO numbers via gemini-2.5-pro, enforcing financial compliance with HITL approval on amounts over $5,000.',
      status: 'active',
      confidenceThreshold: 0.90,
      trigger: {
        type: 'document',
        name: 'Accounts Payable Document Ingest',
        description: 'Accepts PDF, PNG, TIFF invoice uploads',
        config: {
          supportedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
          maxFileSizeBytes: 15 * 1024 * 1024,
          autoOcr: true,
        },
      },
      nodes: [
        {
          id: 'node-invoice-extract',
          name: 'Gemini 2.5 Pro Multimodal Invoice Parser',
          type: 'context_extraction',
          description: 'Deep document extraction extracting vendor, line items, VAT, and total invoice amount',
          position: { x: 300, y: 150 },
          config: {
            model: 'gemini-2.5-pro',
            promptTemplate: 'Extract all financial data and line items from this invoice document with complete accounting accuracy.',
            targetSchema: {
              type: 'object',
              properties: {
                vendorName: { type: 'string' },
                invoiceNumber: { type: 'string' },
                invoiceDate: { type: 'string' },
                currency: { type: 'string' },
                totalAmount: { type: 'number' },
                taxAmount: { type: 'number' },
                poNumber: { type: 'string' },
                lineItemsCount: { type: 'integer' },
                complianceVerified: { type: 'boolean' },
              },
              required: ['vendorName', 'invoiceNumber', 'totalAmount'],
            },
          },
        },
        {
          id: 'node-amount-router',
          name: 'Finance Approval Threshold Router',
          type: 'conditional_router',
          description: 'Routes invoices > $5,000 to CFO/Finance Director for approval',
          position: { x: 600, y: 150 },
          config: {
            evaluationMode: 'first_match',
            branches: [
              {
                id: 'branch-high-value',
                name: 'High Value (> $5,000)',
                conditions: [
                  { field: 'extracted.totalAmount', operator: 'greater_than', value: 5000 },
                ],
                targetNodeId: 'node-finance-hitl',
              },
              {
                id: 'branch-auto-approve',
                name: 'Auto-Approve Under Limit',
                isDefault: true,
                conditions: [],
                targetNodeId: 'node-erp-webhook',
              },
            ],
          },
        },
        {
          id: 'node-finance-hitl',
          name: 'Finance Director HITL Approval',
          type: 'hitl_review',
          description: 'Requires human sign-off for large disbursements or low extraction confidence',
          position: { x: 900, y: 80 },
          config: {
            confidenceThreshold: 0.90,
            assignedRole: 'Finance Director',
            bypassIfConfidenceMet: false,
          },
        },
        {
          id: 'node-erp-webhook',
          name: 'ERP / NetSuite Relay Webhook',
          type: 'external_dispatcher',
          description: 'Posts structured invoice transaction into corporate ERP',
          position: { x: 900, y: 250 },
          config: {
            channel: 'webhook',
            destination: 'https://netsuite.internal.corp/api/v2/bills',
            template: 'Invoice {{extracted.invoiceNumber}} from {{extracted.vendorName}} total {{extracted.currency}} {{extracted.totalAmount}} posted to general ledger.',
            includeRawPayload: true,
            includeStepTraces: true,
          },
        },
      ],
      edges: [
        { id: 'ei1', source: 'trigger', target: 'node-invoice-extract' },
        { id: 'ei2', source: 'node-invoice-extract', target: 'node-amount-router' },
        { id: 'ei3', source: 'node-amount-router', target: 'node-finance-hitl', conditionId: 'branch-high-value', label: 'Amount > $5,000' },
        { id: 'ei4', source: 'node-amount-router', target: 'node-erp-webhook', conditionId: 'branch-auto-approve', label: 'Auto-Approved' },
        { id: 'ei5', source: 'node-finance-hitl', target: 'node-erp-webhook', label: 'On Approval' },
      ],
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Security Anomaly & Telemetry Sentinel
    const securityWorkflow: Workflow = {
      id: 'wf-security-sentinel',
      tenantId: 'tenant-enterprise-01',
      name: 'Security Anomaly & Telemetry Sentinel',
      description: 'Ingests cloud telemetry and server auth logs, classifies threats via Gemini 2.5 Flash, and automatically triggers IP block webhooks and incident notifications.',
      status: 'active',
      confidenceThreshold: 0.88,
      trigger: {
        type: 'scheduled',
        name: 'Telemetry Polling Stream',
        description: 'Runs every 5 minutes against SIEM stream',
        config: {
          cronExpression: '*/5 * * * *',
          timezone: 'UTC',
        },
      },
      nodes: [
        {
          id: 'node-threat-classifier',
          name: 'Threat Level & Anomaly Classifier',
          type: 'semantic_classifier',
          description: 'Classifies telemetry patterns into benign, reconnaissance, brute force, or credential stuffing',
          position: { x: 300, y: 150 },
          config: {
            model: 'gemini-2.5-flash',
            detectSentiment: false,
            confidenceThreshold: 0.88,
            categories: [
              { id: 'brute_force', name: 'Brute Force Attack', description: 'Repeated failed auth spikes from distributed IPs', priority: 'critical' },
              { id: 'privilege_escalation', name: 'Privilege Escalation Attempt', description: 'Unauthorized role assignment attempts', priority: 'critical' },
              { id: 'suspicious_traffic', name: 'Suspicious Bot Traversal', description: 'Path traversal or scraper footprint', priority: 'medium' },
              { id: 'benign_telemetry', name: 'Benign Operational Activity', description: 'Normal health checks and routine traffic', priority: 'low' },
            ],
          },
        },
        {
          id: 'node-sec-router',
          name: 'Threat Mitigation Router',
          type: 'conditional_router',
          description: 'Routes critical security threats to automated firewall block and alert',
          position: { x: 600, y: 150 },
          config: {
            evaluationMode: 'first_match',
            branches: [
              {
                id: 'branch-critical-sec',
                name: 'Critical Attack Vector',
                conditions: [
                  { field: 'category', operator: 'in', value: ['brute_force', 'privilege_escalation'] },
                ],
                targetNodeId: 'node-sec-slack',
              },
              {
                id: 'branch-benign',
                name: 'Log and Retain',
                isDefault: true,
                conditions: [],
                targetNodeId: 'node-sec-log',
              },
            ],
          },
        },
        {
          id: 'node-sec-slack',
          name: 'Security Ops War Room Alert',
          type: 'external_dispatcher',
          description: 'High-priority alert to #secops-alerts',
          position: { x: 900, y: 100 },
          config: {
            channel: 'slack',
            destination: '#secops-alerts',
            template: '🛡️ *SECURITY THREAT MITIGATED*\n*Classification:* {{category}}\n*Confidence:* {{confidenceScore}}\n*Payload:* {{input.sourceIp}} attempted suspicious actions.',
            includeRawPayload: true,
            includeStepTraces: true,
          },
        },
        {
          id: 'node-sec-log',
          name: 'Security Audit Relay',
          type: 'external_dispatcher',
          description: 'Relays sanitized log to long-term cold audit storage',
          position: { x: 900, y: 240 },
          config: {
            channel: 'webhook',
            destination: 'https://audit.security.internal/events',
            template: 'Audit log archived: {{category}} - {{status}}',
            includeRawPayload: false,
            includeStepTraces: false,
          },
        },
      ],
      edges: [
        { id: 'es1', source: 'trigger', target: 'node-threat-classifier' },
        { id: 'es2', source: 'node-threat-classifier', target: 'node-sec-router' },
        { id: 'es3', source: 'node-sec-router', target: 'node-sec-slack', conditionId: 'branch-critical-sec', label: 'Critical Threat' },
        { id: 'es4', source: 'node-sec-router', target: 'node-sec-log', conditionId: 'branch-benign', label: 'Benign Log' },
      ],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workflows.set(supportWorkflow.id, supportWorkflow);
    this.workflows.set(invoiceWorkflow.id, invoiceWorkflow);
    this.workflows.set(securityWorkflow.id, securityWorkflow);

    // Seed realistic sample historical executions for deep telemetry and analytics
    this.seedHistoricalExecutions();
  }

  seedHistoricalExecutions() {
    const samplePayloads = [
      {
        ticketBody: 'CRITICAL: Our primary payment gateway is throwing HTTP 504 Gateway Timeout errors across all European production clusters. Customers cannot complete checkout. This violates our 99.99% enterprise SLA.',
        customerEmail: 'cto@fintechglobal.corp',
      },
      {
        ticketBody: 'Hi team, could you please clarify if your REST API supports bulk upsert endpoints for enterprise contacts? We are migrating 200k records next quarter.',
        customerEmail: 'devops-lead@acme-saas.io',
      },
      {
        ticketBody: 'URGENT: We noticed our invoice was charged $8,420 instead of the agreed contract rate of $4,500. We will suspend services if not credited immediately!',
        customerEmail: 'billing-director@megacorp.com',
      },
      {
        ticketBody: 'The dashboard exports to CSV are missing the customer country column. Not urgent, just a small convenience issue for our weekly reporting.',
        customerEmail: 'analyst@retailcorp.com',
      },
    ];

    const now = Date.now();
    for (let i = 0; i < 28; i++) {
      const execId = `exec-hist-${1000 + i}`;
      const payload = samplePayloads[i % samplePayloads.length];
      const isFailed = i === 7 || i === 19;
      const isPendingHitl = i === 3 || i === 15;
      const status = isFailed ? 'failed' : isPendingHitl ? 'pending_hitl' : 'success';
      const timeOffset = (28 - i) * (3600000 * 2.5); // spread over last few days
      const createdAt = new Date(now - timeOffset).toISOString();
      const latency = Math.floor(1200 + Math.random() * 2400);
      const promptTokens = Math.floor(450 + Math.random() * 200);
      const candidateTokens = Math.floor(180 + Math.random() * 120);
      const totalTokens = promptTokens + candidateTokens;
      const costUsd = Number(((promptTokens * 0.00000015) + (candidateTokens * 0.0000006)).toFixed(6));

      const steps: StepTrace[] = [
        {
          id: `step-${execId}-1`,
          executionId: execId,
          nodeId: 'node-classifier',
          nodeType: 'semantic_classifier',
          nodeName: 'Intent & Urgency Classifier',
          status: 'completed',
          inputData: payload,
          outputData: {
            category: i % 2 === 0 ? 'critical_outage' : 'billing_dispute',
            confidenceScore: isPendingHitl ? 0.72 : 0.94,
            sentiment: 'negative',
            urgency: 'critical',
          },
          reasoning: 'High-severity keywords detected regarding checkout downtime and financial impact.',
          confidenceScore: isPendingHitl ? 0.72 : 0.94,
          latencyMs: 780,
          promptTokens: 320,
          candidateTokens: 95,
          totalTokens: 415,
          costUsd: 0.000105,
          modelUsed: 'gemini-2.5-flash',
          retryCount: 0,
          createdAt: createdAt,
          completedAt: new Date(new Date(createdAt).getTime() + 780).toISOString(),
        },
        {
          id: `step-${execId}-2`,
          executionId: execId,
          nodeId: 'node-extractor',
          nodeType: 'context_extraction',
          nodeName: 'Entity & Key Info Extractor',
          status: isFailed ? 'failed' : 'completed',
          inputData: payload,
          outputData: isFailed ? null : {
            accountId: 'FintechGlobal EU',
            severityScore: 9,
            affectedService: 'Payment Gateway API',
            summary: 'EU payment gateway 504 gateway timeout blocking transactions',
            suggestedAction: 'Escalate to Core Infrastructure on-call engineer',
          },
          reasoning: 'Extracted account details and core failure mode.',
          confidenceScore: 0.95,
          latencyMs: 1100,
          promptTokens: 420,
          candidateTokens: 140,
          totalTokens: 560,
          costUsd: 0.000147,
          modelUsed: 'gemini-2.5-flash',
          retryCount: isFailed ? 2 : 0,
          validationErrors: isFailed ? ['Schema validation failed: target field summary was empty after 2 retry attempts'] : undefined,
          createdAt: new Date(new Date(createdAt).getTime() + 780).toISOString(),
          completedAt: new Date(new Date(createdAt).getTime() + 1880).toISOString(),
        },
      ];

      if (!isFailed && !isPendingHitl) {
        steps.push({
          id: `step-${execId}-3`,
          executionId: execId,
          nodeId: 'node-slack-critical',
          nodeType: 'external_dispatcher',
          nodeName: 'Slack #incident-war-room Dispatcher',
          status: 'completed',
          inputData: steps[1].outputData,
          outputData: { delivered: true, channel: '#incident-war-room', ts: '1729002821.002900' },
          latencyMs: 210,
          promptTokens: 0,
          candidateTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          retryCount: 0,
          createdAt: new Date(new Date(createdAt).getTime() + 1880).toISOString(),
          completedAt: new Date(new Date(createdAt).getTime() + 2090).toISOString(),
        });

        this.dispatches.push({
          id: `disp-${execId}`,
          executionId: execId,
          workflowId: 'wf-support-triage',
          channel: 'slack',
          destination: '#incident-war-room',
          status: 'delivered',
          responseCode: 200,
          latencyMs: 210,
          payload: steps[1].outputData,
          renderedMessage: `🚨 *CRITICAL SLA OUTAGE DETECTED*\n*Account:* FintechGlobal EU\n*Summary:* EU payment gateway 504 gateway timeout`,
          createdAt: new Date(new Date(createdAt).getTime() + 2090).toISOString(),
        });
      }

      if (isPendingHitl) {
        const hitlItem: HitlReviewItem = {
          id: `hitl-${execId}`,
          executionId: execId,
          workflowId: 'wf-support-triage',
          workflowName: 'Enterprise Support Triage & SLA Router',
          stepId: steps[0].id,
          nodeId: 'node-classifier',
          status: 'pending',
          confidenceScore: 0.72,
          threshold: 0.85,
          reasoning: 'Classification confidence of 0.72 is below the 0.85 threshold. Ambiguous phrasing between billing dispute and technical failure.',
          originalPayload: payload,
          extractedPayload: steps[0].outputData,
          createdAt: createdAt,
        };
        this.hitlReviews.set(hitlItem.id, hitlItem);
      }

      const executionRun: ExecutionRun = {
        id: execId,
        workflowId: 'wf-support-triage',
        workflowName: 'Enterprise Support Triage & SLA Router',
        tenantId: 'tenant-enterprise-01',
        triggerType: 'webhook',
        status: status,
        inputPayload: payload,
        outputPayload: isFailed ? null : steps[steps.length - 1]?.outputData,
        latencyMs: latency,
        totalTokens: totalTokens,
        totalCostUsd: costUsd,
        steps: steps,
        errorMessage: isFailed ? 'Model output schema validation error after 2 retries' : undefined,
        createdAt: createdAt,
        updatedAt: new Date(new Date(createdAt).getTime() + latency).toISOString(),
      };

      this.executions.set(execId, executionRun);
    }
  }
}

export const localStore = new Store();

// ==============================================================================
// PERSISTENCE ADAPTER WITH HYBRID SUPABASE SYNC
// ==============================================================================

export const db = {
  async getWorkflows(): Promise<Workflow[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            tenantId: d.tenant_id,
            name: d.name,
            description: d.description,
            status: d.status,
            trigger: d.trigger,
            nodes: d.nodes,
            edges: d.edges,
            confidenceThreshold: d.confidence_threshold,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (e) {
        // Fall back gracefully
      }
    }
    return Array.from(localStore.workflows.values());
  },

  async getWorkflowById(id: string): Promise<Workflow | null> {
    const list = await this.getWorkflows();
    return list.find(w => w.id === id) || null;
  },

  async saveWorkflow(workflow: Workflow): Promise<Workflow> {
    localStore.workflows.set(workflow.id, workflow);
    if (supabase) {
      try {
        await supabase.from('workflows').upsert({
          id: workflow.id,
          tenant_id: workflow.tenantId,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          trigger: workflow.trigger,
          nodes: workflow.nodes,
          edges: workflow.edges,
          confidence_threshold: workflow.confidenceThreshold,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[Supabase Sync] Upsert skipped:', e);
      }
    }
    return workflow;
  },

  async deleteWorkflow(id: string): Promise<boolean> {
    localStore.workflows.delete(id);
    if (supabase) {
      try {
        await supabase.from('workflows').delete().eq('id', id);
      } catch (e) {
        // Fall back
      }
    }
    return true;
  },

  async getExecutions(limit = 50): Promise<ExecutionRun[]> {
    const list = Array.from(localStore.executions.values());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  },

  async getExecutionById(id: string): Promise<ExecutionRun | null> {
    return localStore.executions.get(id) || null;
  },

  async saveExecution(run: ExecutionRun): Promise<ExecutionRun> {
    localStore.executions.set(run.id, run);
    if (supabase) {
      try {
        await supabase.from('executions').upsert({
          id: run.id,
          workflow_id: run.workflowId,
          tenant_id: run.tenantId,
          trigger_type: run.triggerType,
          status: run.status,
          input_payload: run.inputPayload,
          output_payload: run.outputPayload,
          latency_ms: run.latencyMs,
          total_tokens: run.totalTokens,
          total_cost_usd: run.totalCostUsd,
          error_message: run.errorMessage,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        // Fall back
      }
    }
    return run;
  },

  async getHitlReviews(): Promise<HitlReviewItem[]> {
    const list = Array.from(localStore.hitlReviews.values());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getHitlReviewById(id: string): Promise<HitlReviewItem | null> {
    return localStore.hitlReviews.get(id) || null;
  },

  async saveHitlReview(item: HitlReviewItem): Promise<HitlReviewItem> {
    localStore.hitlReviews.set(item.id, item);
    return item;
  },

  async getDispatches(limit = 50): Promise<ExternalDispatchLog[]> {
    return [...localStore.dispatches].reverse().slice(0, limit);
  },

  async saveDispatch(log: ExternalDispatchLog): Promise<ExternalDispatchLog> {
    localStore.dispatches.push(log);
    return log;
  },

  async checkSupabaseHealth(): Promise<{ online: boolean; url: string; tableCount?: number; tables?: Record<string, boolean> }> {
    if (!supabase) {
      return { online: false, url: 'Not Configured' };
    }
    const tableStatus: Record<string, boolean> = {
      workflows: false,
      executions: false,
      execution_steps: false,
      hitl_reviews: false,
      dispatches: false,
    };

    let liveCount = 0;
    for (const tbl of Object.keys(tableStatus)) {
      try {
        const { error } = await supabase.from(tbl).select('id').limit(1);
        if (!error) {
          tableStatus[tbl] = true;
          liveCount++;
        }
      } catch {
        tableStatus[tbl] = false;
      }
    }

    return {
      online: liveCount > 0,
      url: SUPABASE_URL,
      tableCount: liveCount,
      tables: tableStatus,
    };
  },

  async syncToSupabase(): Promise<{ success: boolean; synced: boolean; message: string; tableStatus: Record<string, boolean>; counts?: Record<string, number> }> {
    if (!supabase) {
      return { success: false, synced: false, message: 'Supabase client not initialized', tableStatus: {} };
    }

    const health = await this.checkSupabaseHealth();
    if (!health.tables?.workflows) {
      return {
        success: false,
        synced: false,
        message: "Supabase tables not detected. Please run the SQL schema in Supabase Dashboard (SQL Editor) to create tables.",
        tableStatus: health.tables || {},
      };
    }

    let workflowsSynced = 0;
    let executionsSynced = 0;
    let hitlSynced = 0;

    // Sync workflows
    for (const wf of localStore.workflows.values()) {
      try {
        await supabase.from('workflows').upsert({
          id: wf.id,
          tenant_id: wf.tenantId,
          name: wf.name,
          description: wf.description,
          status: wf.status,
          confidence_threshold: wf.confidenceThreshold,
          trigger: wf.trigger,
          nodes: wf.nodes,
          edges: wf.edges,
          updated_at: new Date().toISOString(),
        });
        workflowsSynced++;
      } catch (err) {
        console.warn('Sync workflow error:', err);
      }
    }

    // Sync executions
    if (health.tables?.executions) {
      for (const run of localStore.executions.values()) {
        try {
          await supabase.from('executions').upsert({
            id: run.id,
            workflow_id: run.workflowId,
            tenant_id: run.tenantId,
            trigger_type: run.triggerType,
            status: run.status,
            input_payload: run.inputPayload,
            output_payload: run.outputPayload,
            latency_ms: run.latencyMs,
            total_tokens: run.totalTokens,
            total_cost_usd: run.totalCostUsd,
            error_message: run.errorMessage,
            updated_at: new Date().toISOString(),
          });
          executionsSynced++;
        } catch (err) {
          console.warn('Sync execution error:', err);
        }
      }
    }

    // Sync HITL reviews
    if (health.tables?.hitl_reviews) {
      for (const hitl of localStore.hitlReviews.values()) {
        try {
          await supabase.from('hitl_reviews').upsert({
            id: hitl.id,
            execution_id: hitl.executionId,
            workflow_id: hitl.workflowId,
            step_id: hitl.stepId,
            node_id: hitl.nodeId,
            status: hitl.status,
            confidence_score: hitl.confidenceScore,
            threshold: hitl.threshold,
            reasoning: hitl.reasoning,
            original_payload: hitl.originalPayload,
            extracted_payload: hitl.extractedPayload,
            modified_payload: hitl.modifiedPayload,
            operator_notes: hitl.operatorNotes,
            created_at: hitl.createdAt,
          });
          hitlSynced++;
        } catch (err) {
          console.warn('Sync hitl error:', err);
        }
      }
    }

    return {
      success: true,
      synced: true,
      message: `Successfully synchronized data with Supabase PostgreSQL!`,
      tableStatus: health.tables,
      counts: {
        workflows: workflowsSynced,
        executions: executionsSynced,
        hitl_reviews: hitlSynced,
      },
    };
  },
};
