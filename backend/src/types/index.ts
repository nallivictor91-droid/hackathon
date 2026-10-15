import { z } from 'zod';

// ==============================================================================
// WORKFLOW DEFINITIONS & NODE TAXONOMY
// ==============================================================================

export type TriggerType = 'webhook' | 'manual' | 'document' | 'scheduled';

export type NodeType = 
  | 'context_extraction'
  | 'semantic_classifier'
  | 'conditional_router'
  | 'hitl_review'
  | 'external_dispatcher';

export interface WebhookTriggerConfig {
  webhookToken: string;
  allowedOrigins?: string[];
  signatureHeader?: string;
}

export interface DocumentTriggerConfig {
  supportedMimeTypes: string[];
  maxFileSizeBytes: number;
  autoOcr: boolean;
}

export interface ScheduledTriggerConfig {
  cronExpression: string;
  timezone: string;
}

export interface ManualTriggerConfig {
  inputSchema?: Record<string, any>;
}

export interface TriggerDefinition {
  type: TriggerType;
  name: string;
  description: string;
  config: WebhookTriggerConfig | DocumentTriggerConfig | ScheduledTriggerConfig | ManualTriggerConfig;
}

// Logic Node Configs
export interface ContextExtractionConfig {
  model: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  systemInstruction?: string;
  promptTemplate: string;
  targetSchema: Record<string, any>;
  temperature?: number;
  maxRetries?: number;
}

export interface SemanticClassifierConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  categories: { id: string; name: string; description: string; priority?: 'low' | 'medium' | 'high' | 'critical' }[];
  detectSentiment: boolean;
  confidenceThreshold: number;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'matches_regex';
  value: any;
}

export interface RouterBranch {
  id: string;
  name: string;
  conditions: RuleCondition[];
  targetNodeId: string;
  isDefault?: boolean;
}

export interface ConditionalRouterConfig {
  branches: RouterBranch[];
  evaluationMode: 'first_match' | 'all_matches';
}

export interface HitlReviewConfig {
  confidenceThreshold: number; // e.g. 0.85
  timeoutHours?: number;
  assignedRole?: string;
  requiredFields?: string[];
  bypassIfConfidenceMet: boolean;
}

export interface ExternalDispatcherConfig {
  channel: 'slack' | 'crm' | 'webhook' | 'email';
  destination: string; // e.g. "#incident-alerts", "hubspot/deals", "https://api.partner.com/events"
  template: string;
  includeRawPayload: boolean;
  includeStepTraces: boolean;
}

export type NodeConfig = 
  | ContextExtractionConfig
  | SemanticClassifierConfig
  | ConditionalRouterConfig
  | HitlReviewConfig
  | ExternalDispatcherConfig;

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  description?: string;
  config: NodeConfig;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionId?: string;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  trigger: TriggerDefinition;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  confidenceThreshold: number;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// EXECUTION & TELEMETRY DEFINITIONS
// ==============================================================================

export type ExecutionStatus = 'running' | 'success' | 'failed' | 'pending_hitl' | 'retried';

export interface StepTrace {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_hitl';
  inputData: any;
  outputData: any;
  reasoning?: string;
  confidenceScore?: number;
  latencyMs: number;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  costUsd: number;
  modelUsed?: string;
  retryCount: number;
  validationErrors?: string[];
  createdAt: string;
  completedAt?: string;
}

export interface ExecutionRun {
  id: string;
  workflowId: string;
  workflowName: string;
  tenantId: string;
  triggerType: TriggerType;
  status: ExecutionStatus;
  inputPayload: any;
  outputPayload?: any;
  latencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  steps: StepTrace[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// HUMAN-IN-THE-LOOP (HITL) DEFINITIONS
// ==============================================================================

export type HitlReviewStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

export interface HitlReviewItem {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  stepId: string;
  nodeId: string;
  status: HitlReviewStatus;
  confidenceScore: number;
  threshold: number;
  reasoning: string;
  originalPayload: any;
  extractedPayload: any;
  modifiedPayload?: any;
  operatorNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ==============================================================================
// EXTERNAL INTEGRATION DISPATCH LOG
// ==============================================================================

export interface ExternalDispatchLog {
  id: string;
  executionId: string;
  workflowId: string;
  channel: 'slack' | 'crm' | 'webhook' | 'email';
  destination: string;
  status: 'delivered' | 'failed';
  responseCode: number;
  latencyMs: number;
  payload: any;
  renderedMessage?: string;
  createdAt: string;
}

// ==============================================================================
// TELEMETRY & ANALYTICS DEFINITIONS
// ==============================================================================

export interface TelemetryMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  pendingHitlExecutions: number;
  successRatePercentage: number;
  meanTimeToExecutionMs: number;
  totalTokensConsumed: number;
  totalCostUsd: number;
  activeWorkflowsCount: number;
  modelDistribution: {
    'gemini-2.5-flash': number;
    'gemini-2.5-pro': number;
  };
  failureHeatmap: {
    hour: number;
    day: string;
    failures: number;
    successes: number;
  }[];
  recentActivity: {
    timestamp: string;
    type: 'execution' | 'hitl_approval' | 'hitl_rejection' | 'dispatch';
    message: string;
    status: 'success' | 'warning' | 'error' | 'info';
  }[];
}

// ==============================================================================
// ZOD VALIDATION SCHEMAS
// ==============================================================================

export const CreateWorkflowSchema = z.object({
  name: z.string().min(2, 'Workflow name must be at least 2 characters'),
  description: z.string().default(''),
  status: z.enum(['active', 'paused', 'draft']).default('active'),
  confidenceThreshold: z.number().min(0).max(1).default(0.85),
  trigger: z.object({
    type: z.enum(['webhook', 'manual', 'document', 'scheduled']),
    name: z.string(),
    description: z.string().default(''),
    config: z.record(z.string(), z.any()),
  }),
  nodes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum([
        'context_extraction',
        'semantic_classifier',
        'conditional_router',
        'hitl_review',
        'external_dispatcher',
      ]),
      description: z.string().optional(),
      config: z.record(z.string(), z.any()),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      conditionId: z.string().optional(),
    })
  ).default([]),
});

export const HitlActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  modifiedPayload: z.record(z.string(), z.any()).optional(),
  operatorNotes: z.string().optional(),
  reviewerId: z.string().default('operator-admin'),
});
