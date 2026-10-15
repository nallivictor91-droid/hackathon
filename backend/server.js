const path = require('path');
const fs = require('fs');

// Load Backend Environment Variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const {
  AVAILABLE_MODELS,
  generateChatMessage,
  streamChatMessage,
  validateApiKey
} = require('./geminiService');

const supabaseService = require('./supabaseService');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all incoming cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

/**
 * Helper to read frontend/.env safely for client consumption
 */
function getFrontendEnv() {
  const frontendEnvPath = path.join(__dirname, '../frontend/.env');
  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    BACKEND_API_URL: `http://localhost:${PORT}`,
    GEMINI_DEFAULT_MODEL: 'gemini-1.5-flash',
    APP_NAME: 'Gemini Chatbot'
  };

  if (fs.existsSync(frontendEnvPath)) {
    try {
      const content = fs.readFileSync(frontendEnvPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            // Remove wrapping quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val) envVars[key] = val;
          }
        }
      });
    } catch (e) {
      console.warn('Could not read frontend/.env:', e.message);
    }
  }

  return envVars;
}

/**
 * Dynamic Environment Script for Frontend Client
 * Serves frontend/.env variables into window.__ENV so the browser can read them seamlessly!
 */
app.get('/env.js', (req, res) => {
  const clientEnv = getFrontendEnv();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`window.__ENV = ${JSON.stringify(clientEnv, null, 2)};`);
});

/**
 * JSON Endpoint for Frontend Configuration
 */
app.get('/api/config', (req, res) => {
  res.json(getFrontendEnv());
});

// Serve static frontend files from ../frontend
app.use(express.static(path.join(__dirname, '../frontend')));

/**
 * Health & Configuration Status Check
 */
app.get('/api/status', async (req, res) => {
  const hasServerKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== '' &&
    process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
  );

  const supabaseConfigured = supabaseService.isConfigured();

  res.json({
    status: 'online',
    architecture: {
      layer: 'backend',
      service: 'Node.js Express + Gemini LLM Gateway + Supabase DB',
      environment: process.env.NODE_ENV || 'development'
    },
    hasApiKey: hasServerKey,
    supabase: {
      configured: supabaseConfigured
    },
    defaultModel: 'gemini-3.5-flash-lite',
    availableModels: AVAILABLE_MODELS,
    nodeVersion: process.version,
    serverTime: new Date().toISOString()
  });
});

/**
 * Supabase Connection Status Diagnostic
 */
app.get('/api/supabase/status', async (req, res) => {
  const result = await supabaseService.testConnection();
  res.json(result);
});

/**
 * List available Gemini models
 */
app.get('/api/models', (req, res) => {
  res.json({ models: AVAILABLE_MODELS });
});

/**
 * Validate an API key
 */
app.post('/api/validate-key', async (req, res) => {
  const apiKey = req.body?.apiKey || req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
  const result = await validateApiKey(apiKey);
  res.status(result.valid ? 200 : 400).json(result);
});

/**
 * Get chat history from Supabase database
 */
app.get('/api/history', async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || process.env.DEFAULT_SESSION_ID || 'default-session';
    const messages = await supabaseService.getMessages(sessionId);
    res.json({ sessionId, messages });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear chat history from Supabase database
 */
app.delete('/api/history', async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || process.env.DEFAULT_SESSION_ID || 'default-session';
    await supabaseService.clearHistory(sessionId);
    res.json({ success: true, message: `History cleared for session ${sessionId}` });
  } catch (error) {
    next(error);
  }
});

/**
 * Standard Chat Endpoint (Non-streaming)
 * Request body: { message, history, model, systemInstruction, sessionId }
 */
app.post('/api/chat', async (req, res, next) => {
  try {
    const { message, history, model, systemInstruction, sessionId = 'default-session' } = req.body;
    const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
    }

    // Persist user message to Supabase
    await supabaseService.saveMessage({
      sessionId,
      role: 'user',
      content: message.trim(),
      model
    });

    const response = await generateChatMessage({
      message,
      history,
      model,
      systemInstruction,
      apiKey
    });

    // Persist assistant reply to Supabase
    await supabaseService.saveMessage({
      sessionId,
      role: 'model',
      content: response.reply,
      model: response.model
    });

    res.json({
      success: true,
      reply: response.reply,
      model: response.model,
      timestamp: response.timestamp
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Streaming Chat Endpoint (Server-Sent Events)
 * Sends chunks as they arrive from Gemini and saves full response to Supabase
 */
app.post('/api/chat/stream', async (req, res) => {
  const { message, history, model, systemInstruction, sessionId = 'default-session' } = req.body;
  const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
  }

  // Persist user prompt to Supabase
  await supabaseService.saveMessage({
    sessionId,
    role: 'user',
    content: message.trim(),
    model
  });

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const result = await streamChatMessage(
      { message, history, model, systemInstruction, apiKey },
      (chunk) => {
        // Send chunk to client
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    );

    // Persist complete assistant answer to Supabase
    await supabaseService.saveMessage({
      sessionId,
      role: 'model',
      content: result.fullText,
      model: result.model
    });

    // Notify stream complete
    res.write(`data: ${JSON.stringify({ done: true, model: result.model })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message || 'Error generating response' })}\n\n`);
    res.end();
  }
});

/**
 * Central Error Handler
 */
app.use((err, req, res, next) => {
  console.error('[Backend Error]:', err.message);

  let statusCode = err.status || 500;
  let userMessage = err.message || 'An unexpected server error occurred.';

  if (err.message && err.message.includes('API_KEY_INVALID')) {
    statusCode = 401;
    userMessage = 'The provided Gemini API key is invalid. Please check your key at https://aistudio.google.com/app/apikey';
  } else if (err.message && err.message.includes('Quota exceeded')) {
    statusCode = 429;
    userMessage = 'Gemini API quota exceeded or rate limit reached. Please wait a moment and try again.';
  }

  res.status(statusCode).json({
    error: userMessage,
    code: err.code || 'SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Gemini Chatbot Backend running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Serving Frontend from: ${path.join(__dirname, '../frontend')}`);
  console.log(`🔑 Gemini API Key configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') ? 'YES' : 'NO (Set in backend/.env)'}`);
  console.log(`🗄️ Supabase DB configured: ${supabaseService.isConfigured() ? 'YES' : 'NO (Set in backend/.env & frontend/.env)'}`);
  console.log(`==================================================\n`);
});
