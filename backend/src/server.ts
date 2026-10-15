import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import routers
import { healthRouter } from './routes/health.js';
import { workflowRouter } from './routes/workflows.js';
import { executionRouter } from './routes/executions.js';
import { hitlRouter } from './routes/hitl.js';
import { telemetryRouter } from './routes/telemetry.js';
import { webhookRouter } from './routes/webhooks.js';
import { integrationsRouter } from './routes/integrations.js';
import { documentRouter } from './routes/documents.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Cross-Origin Resource Sharing
app.use(cors({
  origin: true, // Allow frontend dev server and clients
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Webhook-Signature'],
}));

// Rate Limiting (1,000 requests per 15 min per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// High-capacity payload parsing for documents & structured telemetry
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('/telemetry/stream')) {
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount Routes
app.use('/api/health', healthRouter);
app.use('/api/workflows', workflowRouter);
app.use('/api/executions', executionRouter);
app.use('/api/hitl', hitlRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/documents', documentRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error Handler]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`🚀 PulseFlow AI Orchestrator Backend running on port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`🛡️ Architecture: Edge-ready Express + TypeScript + @google/genai`);
  console.log(`========================================================`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => console.log('HTTP server closed'));
});

export default app;
