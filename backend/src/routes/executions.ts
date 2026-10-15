import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';

export const executionRouter = Router();

// GET all executions with optional filtering
executionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const status = req.query.status as string;
    const workflowId = req.query.workflowId as string;

    let list = await db.getExecutions(limit);

    if (status && status !== 'all') {
      list = list.filter(e => e.status === status);
    }

    if (workflowId && workflowId !== 'all') {
      list = list.filter(e => e.workflowId === workflowId);
    }

    res.json({
      success: true,
      count: list.length,
      executions: list,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single execution run by ID with full step traces
executionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const execution = await db.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }

    res.json({
      success: true,
      execution,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
