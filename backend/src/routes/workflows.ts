import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { CreateWorkflowSchema, Workflow } from '../types/index.js';
import { PipelineExecutor } from '../services/pipelineExecutor.js';

export const workflowRouter = Router();

// GET all workflows
workflowRouter.get('/', async (req: Request, res: Response) => {
  try {
    const list = await db.getWorkflows();
    res.json({ success: true, count: list.length, workflows: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single workflow by ID
workflowRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const wf = await db.getWorkflowById(req.params.id);
    if (!wf) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, workflow: wf });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE new workflow
workflowRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = CreateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: parsed.error.format() 
      });
    }

    const newWorkflow: Workflow = {
      id: `wf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: req.body.tenantId || 'tenant-enterprise-01',
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
      confidenceThreshold: parsed.data.confidenceThreshold,
      trigger: parsed.data.trigger as any,
      nodes: parsed.data.nodes as any,
      edges: parsed.data.edges as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveWorkflow(newWorkflow);
    res.status(201).json({ success: true, workflow: newWorkflow });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE workflow
workflowRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await db.getWorkflowById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const updated: Workflow = {
      ...existing,
      ...req.body,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    await db.saveWorkflow(updated);
    res.json({ success: true, workflow: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE workflow
workflowRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.deleteWorkflow(req.params.id);
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DUPLICATE workflow
workflowRouter.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const existing = await db.getWorkflowById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const cloned: Workflow = {
      ...existing,
      id: `wf-${Date.now()}-copy`,
      name: `${existing.name} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveWorkflow(cloned);
    res.status(201).json({ success: true, workflow: cloned });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TRIGGER EXECUTION (Simulation or manual run)
workflowRouter.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const wf = await db.getWorkflowById(req.params.id);
    if (!wf) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const inputPayload = req.body.payload || req.body;
    const execution = await PipelineExecutor.executeWorkflow(wf, inputPayload, {
      inlineFiles: req.body.inlineFiles,
    });

    res.json({ success: true, execution });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
