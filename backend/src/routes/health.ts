import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { executeStructuredPrompt } from '../services/geminiService.js';

export const healthRouter = Router();

// GET /api/health - Comprehensive platform health check
healthRouter.get('/', async (req: Request, res: Response) => {
  const supabaseHealth = await db.checkSupabaseHealth();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10;

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    platform: 'PulseFlow AI - Autonomous Workflow Orchestrator',
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    components: {
      backendServer: {
        status: 'online',
        port: process.env.PORT || 5000,
        architecture: 'Node.js Express + TypeScript (tsx)',
        role: 'Autonomous Pipeline Engine & LLM Gateway',
      },
      geminiEngine: {
        status: hasGeminiKey ? 'configured' : 'missing_api_key',
        defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        sdk: '@google/genai',
      },
      database: {
        status: supabaseHealth.online ? 'supabase_connected' : 'local_fallback_active',
        supabaseUrl: supabaseHealth.url,
        persistenceMode: supabaseHealth.online ? 'PostgreSQL (Supabase)' : 'In-Memory Resilient Hybrid Store',
      },
    },
  });
});

// POST /api/health/test-gemini - Live test of Gemini API connection
healthRouter.post('/test-gemini', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const result = await executeStructuredPrompt({
      model: 'gemini-2.5-flash',
      prompt: 'Respond with a simple JSON message acknowledging system readiness: {"status": "ok", "message": "PulseFlow engine operational"}',
      targetSchema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['status'],
      },
      temperature: 0.1,
    });

    res.json({
      success: true,
      latencyMs: Date.now() - startTime,
      modelUsed: result.modelUsed,
      response: result.data,
      tokens: result.totalTokens,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    });
  }
});

// POST /api/health/sync-supabase - Live verification and sync with Supabase tables
healthRouter.post('/sync-supabase', async (req: Request, res: Response) => {
  try {
    const syncResult = await db.syncToSupabase();
    res.json(syncResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      synced: false,
      error: err.message,
    });
  }
});
