import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { HitlActionSchema } from '../types/index.js';
import { PipelineExecutor } from '../services/pipelineExecutor.js';

export const hitlRouter = Router();

// GET all pending HITL reviews
hitlRouter.get('/pending', async (req: Request, res: Response) => {
  try {
    const list = await db.getHitlReviews();
    const pending = list.filter(item => item.status === 'pending');
    res.json({
      success: true,
      count: pending.length,
      reviews: pending,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single HITL review item
hitlRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await db.getHitlReviewById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'HITL Review item not found' });
    }
    res.json({ success: true, review: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// APPROVE or REJECT a HITL review item
hitlRouter.post('/:id/action', async (req: Request, res: Response) => {
  try {
    const parsed = HitlActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.format(),
      });
    }

    const { action, modifiedPayload, operatorNotes, reviewerId } = parsed.data;
    const item = await db.getHitlReviewById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'HITL Review item not found' });
    }

    if (item.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Review is already resolved with status "${item.status}"`,
      });
    }

    const workflow = await db.getWorkflowById(item.workflowId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Associated workflow not found' });
    }

    item.status = action === 'approve' ? 'approved' : 'rejected';
    item.modifiedPayload = modifiedPayload || item.extractedPayload;
    item.operatorNotes = operatorNotes || '';
    item.reviewedBy = reviewerId;
    item.reviewedAt = new Date().toISOString();

    await db.saveHitlReview(item);

    let updatedExecution = null;

    if (action === 'approve') {
      // Resume downstream pipeline execution
      updatedExecution = await PipelineExecutor.resumeAfterHitlApproval(
        item,
        workflow,
        modifiedPayload
      );
    } else {
      // Mark execution as rejected
      const execution = await db.getExecutionById(item.executionId);
      if (execution) {
        execution.status = 'failed';
        execution.errorMessage = `Execution rejected by human operator (${reviewerId}): ${operatorNotes || 'No notes provided'}`;
        execution.updatedAt = new Date().toISOString();
        await db.saveExecution(execution);
        updatedExecution = execution;
      }
    }

    res.json({
      success: true,
      review: item,
      execution: updatedExecution,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
