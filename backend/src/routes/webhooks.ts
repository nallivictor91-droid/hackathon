import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { PipelineExecutor } from '../services/pipelineExecutor.js';

export const webhookRouter = Router();

// Inbound webhook endpoint: POST /api/webhooks/:webhookToken
webhookRouter.post('/:webhookToken', async (req: Request, res: Response) => {
  const { webhookToken } = req.params;

  try {
    const workflows = await db.getWorkflows();
    const targetWf = workflows.find(
      w => w.trigger.type === 'webhook' && (w.trigger.config as any)?.webhookToken === webhookToken
    );

    if (!targetWf) {
      return res.status(404).json({
        success: false,
        error: `No active workflow found matching webhook token: ${webhookToken}`,
      });
    }

    if (targetWf.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Workflow "${targetWf.name}" is currently ${targetWf.status}. Webhooks are rejected.`,
      });
    }

    const payload = req.body;
    console.log(`[Inbound Webhook] Received event for workflow "${targetWf.name}" (${targetWf.id})`);

    // Execute pipeline asynchronously or synchronously based on caller preferences
    const sync = req.query.sync === 'true';
    if (sync) {
      const execution = await PipelineExecutor.executeWorkflow(targetWf, payload);
      return res.json({
        success: true,
        workflowId: targetWf.id,
        executionId: execution.id,
        status: execution.status,
        latencyMs: execution.latencyMs,
        execution,
      });
    }

    // Trigger asynchronously for fast 202 Accepted response
    PipelineExecutor.executeWorkflow(targetWf, payload).catch(err => {
      console.error(`[Inbound Webhook] Async execution failed:`, err);
    });

    res.status(202).json({
      success: true,
      message: 'Webhook payload accepted for autonomous processing',
      workflowId: targetWf.id,
      workflowName: targetWf.name,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
