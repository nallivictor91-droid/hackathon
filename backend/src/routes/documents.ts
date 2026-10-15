import { Router, Request, Response } from 'express';
import multer from 'multer';
import { executeStructuredPrompt } from '../services/geminiService.js';

export const documentRouter = Router();

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// POST /api/documents/extract - Multimodal document extraction endpoint
documentRouter.post('/extract', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const prompt = req.body.prompt || 'Extract key structured entities, invoice items, amounts, dates, and parties from this document.';
    const model = req.body.model || 'gemini-2.5-pro';

    let schema: any = undefined;
    if (req.body.schema) {
      try {
        schema = typeof req.body.schema === 'string' ? JSON.parse(req.body.schema) : req.body.schema;
      } catch {
        // default schema if invalid
      }
    }

    if (!schema) {
      schema = {
        type: 'object',
        properties: {
          documentType: { type: 'string' },
          vendorOrIssuer: { type: 'string' },
          documentDate: { type: 'string' },
          referenceNumber: { type: 'string' },
          totalAmount: { type: 'number' },
          currency: { type: 'string' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                amount: { type: 'number' },
              },
            },
          },
          summary: { type: 'string' },
        },
        required: ['documentType', 'totalAmount', 'summary'],
      };
    }

    const inlineFiles = file ? [
      {
        mimeType: file.mimetype,
        dataBase64: file.buffer.toString('base64'),
      },
    ] : [];

    const result = await executeStructuredPrompt({
      model: model as any,
      prompt,
      targetSchema: schema,
      inlineFiles,
      temperature: 0.1,
    });

    res.json({
      success: true,
      extractedData: result.data,
      metrics: {
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        candidateTokens: result.candidateTokens,
        totalTokens: result.totalTokens,
        costUsd: result.costUsd,
        modelUsed: result.modelUsed,
        retryCount: result.retryCount,
      },
      fileDetails: file ? {
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      } : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
