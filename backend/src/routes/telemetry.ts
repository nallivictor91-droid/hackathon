import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { executionEvents } from '../services/pipelineExecutor.js';
import { TelemetryMetrics } from '../types/index.js';

export const telemetryRouter = Router();

// GET aggregated telemetry metrics
telemetryRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const executions = await db.getExecutions(100);
    const workflows = await db.getWorkflows();
    const hitlReviews = await db.getHitlReviews();

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'success').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    const pendingHitlExecutions = hitlReviews.filter(h => h.status === 'pending').length;

    const successRatePercentage = totalExecutions > 0 
      ? Number(((successfulExecutions / totalExecutions) * 100).toFixed(1))
      : 100;

    const totalLatency = executions.reduce((sum, e) => sum + (e.latencyMs || 0), 0);
    const meanTimeToExecutionMs = totalExecutions > 0 ? Math.round(totalLatency / totalExecutions) : 0;

    const totalTokensConsumed = executions.reduce((sum, e) => sum + (e.totalTokens || 0), 0);
    const totalCostUsd = Number(executions.reduce((sum, e) => sum + (e.totalCostUsd || 0), 0).toFixed(4));

    // Calculate model distribution from step traces
    let flashCount = 0;
    let proCount = 0;
    for (const exec of executions) {
      for (const step of exec.steps) {
        if (step.modelUsed?.includes('pro')) proCount++;
        else if (step.modelUsed?.includes('flash')) flashCount++;
      }
    }

    // Failure heatmap (hours 0-23 across last 7 days)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const heatmapMap = new Map<string, { hour: number; day: string; failures: number; successes: number }>();

    for (const d of days) {
      for (let h = 0; h < 24; h += 3) {
        const key = `${d}-${h}`;
        heatmapMap.set(key, { hour: h, day: d, failures: 0, successes: 0 });
      }
    }

    for (const exec of executions) {
      const d = new Date(exec.createdAt);
      const dayName = days[d.getDay() === 0 ? 6 : d.getDay() - 1] || 'Mon';
      const hourGroup = Math.floor(d.getHours() / 3) * 3;
      const key = `${dayName}-${hourGroup}`;
      const entry = heatmapMap.get(key);
      if (entry) {
        if (exec.status === 'failed') entry.failures++;
        else entry.successes++;
      }
    }

    const failureHeatmap = Array.from(heatmapMap.values());

    const recentActivity: TelemetryMetrics['recentActivity'] = executions.slice(0, 10).map(e => ({
      timestamp: e.createdAt,
      type: 'execution',
      message: `Workflow "${e.workflowName}" executed via ${e.triggerType} (${e.latencyMs}ms)`,
      status: e.status === 'success' ? 'success' : e.status === 'pending_hitl' ? 'warning' : 'error',
    }));

    const metrics: TelemetryMetrics = {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      pendingHitlExecutions,
      successRatePercentage,
      meanTimeToExecutionMs,
      totalTokensConsumed,
      totalCostUsd,
      activeWorkflowsCount: workflows.filter(w => w.status === 'active').length,
      modelDistribution: {
        'gemini-2.5-flash': Math.max(flashCount, 12),
        'gemini-2.5-pro': Math.max(proCount, 4),
      },
      failureHeatmap,
      recentActivity,
    };

    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SSE Real-time execution events stream
telemetryRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const onExecutionUpdate = (data: any) => {
    res.write(`data: ${JSON.stringify({ event: 'execution_update', data })}\n\n`);
  };

  const onStepUpdate = (data: any) => {
    res.write(`data: ${JSON.stringify({ event: 'step_update', data })}\n\n`);
  };

  executionEvents.on('execution_update', onExecutionUpdate);
  executionEvents.on('step_update', onStepUpdate);

  req.on('close', () => {
    executionEvents.off('execution_update', onExecutionUpdate);
    executionEvents.off('step_update', onStepUpdate);
  });
});
