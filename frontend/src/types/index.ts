export type TriggerType = 'webhook' | 'manual' | 'document' | 'scheduled';

export type NodeType = 
  | 'context_extraction'
  | 'semantic_classifier'
  | 'conditional_router'
  | 'hitl_review'
  | 'external_dispatcher';

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  description?: string;
  config: Record<string, any>;
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
  trigger: {
    type: TriggerType;
    name: string;
    description: string;
    config: Record<string, any>;
  };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  confidenceThreshold: number;
  createdAt: string;
  updatedAt: string;
}

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

export interface HitlReviewItem {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  stepId: string;
  nodeId: string;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
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
