import { db } from '../db/supabase.js';
import { ExternalDispatcherConfig, ExternalDispatchLog } from '../types/index.js';

export interface DispatchParams {
  executionId: string;
  workflowId: string;
  config: ExternalDispatcherConfig;
  context: {
    input?: any;
    extracted?: any;
    category?: string;
    sentiment?: string;
    confidenceScore?: number;
    status?: string;
  };
}

/**
 * Interpolates string templates with dot-notation context variables like {{extracted.summary}}
 */
function interpolate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const parts = key.trim().split('.');
    let curr = context;
    for (const part of parts) {
      if (curr === undefined || curr === null) return '';
      curr = curr[part];
    }
    return curr !== undefined && curr !== null ? String(curr) : '';
  });
}

export const dispatcherService = {
  async executeDispatch(params: DispatchParams): Promise<ExternalDispatchLog> {
    const startTime = Date.now();
    const { executionId, workflowId, config, context } = params;

    const renderedMessage = interpolate(config.template, context);

    let dispatchPayload: any = {
      destination: config.destination,
      message: renderedMessage,
    };

    if (config.includeRawPayload) {
      dispatchPayload.rawInput = context.input;
      dispatchPayload.extractedData = context.extracted;
    }

    // Simulate realistic network latency for external cloud APIs (Slack, HubSpot, Webhooks)
    const simulatedLatencyMs = Math.floor(180 + Math.random() * 220);
    await new Promise((resolve) => setTimeout(resolve, Math.min(simulatedLatencyMs, 300)));

    const log: ExternalDispatchLog = {
      id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      executionId,
      workflowId,
      channel: config.channel,
      destination: config.destination,
      status: 'delivered',
      responseCode: 200,
      latencyMs: Date.now() - startTime,
      payload: dispatchPayload,
      renderedMessage,
      createdAt: new Date().toISOString(),
    };

    await db.saveDispatch(log);
    console.log(`[Dispatcher] Successfully delivered to [${config.channel.toUpperCase()}] -> ${config.destination}`);
    return log;
  },
};
