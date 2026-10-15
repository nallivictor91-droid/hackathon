import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';

export const integrationsRouter = Router();

// GET all external dispatches
integrationsRouter.get('/dispatches', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const channel = req.query.channel as string;

    let list = await db.getDispatches(limit);
    if (channel && channel !== 'all') {
      list = list.filter(d => d.channel === channel);
    }

    res.json({
      success: true,
      count: list.length,
      dispatches: list,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET integration status & delivery statistics
integrationsRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const list = await db.getDispatches(100);
    const channels = {
      slack: { total: 0, delivered: 0, failed: 0 },
      crm: { total: 0, delivered: 0, failed: 0 },
      webhook: { total: 0, delivered: 0, failed: 0 },
      email: { total: 0, delivered: 0, failed: 0 },
    };

    for (const d of list) {
      if (channels[d.channel]) {
        channels[d.channel].total++;
        if (d.status === 'delivered') channels[d.channel].delivered++;
        else channels[d.channel].failed++;
      }
    }

    res.json({
      success: true,
      stats: {
        totalDispatches: list.length,
        channelBreakdown: channels,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
