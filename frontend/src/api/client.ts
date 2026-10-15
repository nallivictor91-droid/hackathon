import { 
  Workflow, 
  ExecutionRun, 
  HitlReviewItem, 
  ExternalDispatchLog, 
  TelemetryMetrics 
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = {
  // WORKFLOWS
  async getWorkflows(): Promise<Workflow[]> {
    const res = await fetch(`${BASE_URL}/workflows`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.workflows;
  },

  async getWorkflow(id: string): Promise<Workflow> {
    const res = await fetch(`${BASE_URL}/workflows/${id}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.workflow;
  },

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    const res = await fetch(`${BASE_URL}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.workflow;
  },

  async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
    const res = await fetch(`${BASE_URL}/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.workflow;
  },

  async deleteWorkflow(id: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/workflows/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return true;
  },

  async executeWorkflow(id: string, payload: any, inlineFiles?: any[]): Promise<ExecutionRun> {
    const res = await fetch(`${BASE_URL}/workflows/${id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, inlineFiles }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.execution;
  },

  // EXECUTIONS
  async getExecutions(status?: string, workflowId?: string): Promise<ExecutionRun[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (workflowId && workflowId !== 'all') params.set('workflowId', workflowId);
    
    const res = await fetch(`${BASE_URL}/executions?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.executions;
  },

  async getExecution(id: string): Promise<ExecutionRun> {
    const res = await fetch(`${BASE_URL}/executions/${id}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.execution;
  },

  // HITL REVIEWS
  async getPendingHitlReviews(): Promise<HitlReviewItem[]> {
    const res = await fetch(`${BASE_URL}/hitl/pending`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.reviews;
  },

  async actionHitlReview(
    id: string, 
    action: 'approve' | 'reject', 
    modifiedPayload?: any, 
    operatorNotes?: string
  ): Promise<{ review: HitlReviewItem; execution: ExecutionRun }> {
    const res = await fetch(`${BASE_URL}/hitl/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        modifiedPayload,
        operatorNotes,
        reviewerId: 'operator-lead',
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  // TELEMETRY
  async getTelemetryStats(): Promise<TelemetryMetrics> {
    const res = await fetch(`${BASE_URL}/telemetry/stats`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.metrics;
  },

  // DISPATCHES & INTEGRATIONS
  async getDispatches(channel?: string): Promise<ExternalDispatchLog[]> {
    const params = new URLSearchParams();
    if (channel && channel !== 'all') params.set('channel', channel);

    const res = await fetch(`${BASE_URL}/integrations/dispatches?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.dispatches;
  },

  // HEALTH & ARCHITECTURE
  async getHealth(): Promise<any> {
    const res = await fetch(`${BASE_URL}/health`);
    return await res.json();
  },

  async testGemini(): Promise<any> {
    const res = await fetch(`${BASE_URL}/health/test-gemini`, { method: 'POST' });
    return await res.json();
  },

  async syncSupabase(): Promise<any> {
    const res = await fetch(`${BASE_URL}/health/sync-supabase`, { method: 'POST' });
    return await res.json();
  },

  // DOCUMENT EXTRACTION
  async extractDocument(formData: FormData): Promise<any> {
    const res = await fetch(`${BASE_URL}/documents/extract`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },
};
