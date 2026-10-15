const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini Service
 * Handles all direct interactions with the Google Gemini API.
 * This keeps the API key and LLM logic isolated in the backend.
 */

// Available recommended models
const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Next-gen blazing fast, highly versatile' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Lightweight & highly responsive' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'High capability model for complex tasks' }
];

/**
 * Get an initialized GoogleGenerativeAI client
 * @param {string} [apiKeyOverride] - Optional API key passed from request
 * @returns {GoogleGenerativeAI}
 */
function getClient(apiKeyOverride) {
  const key = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key === 'YOUR_GEMINI_API_KEY_HERE') {
    const error = new Error('GEMINI_API_KEY is not configured on the server or provided by the client.');
    error.status = 401;
    error.code = 'MISSING_API_KEY';
    throw error;
  }
  return new GoogleGenerativeAI(key.trim());
}

/**
 * Format chat history from client format [{role: 'user'|'model', content: '...'}]
 * into the Google Generative AI SDK format [{role: 'user'|'model', parts: [{text: '...'}]}]
 * @param {Array} history 
 * @returns {Array}
 */
function formatHistory(history = []) {
  return history
    .filter(msg => msg && msg.role && msg.content)
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));
}

/**
 * Send a message and get a full response
 * @param {Object} options
/**
 * Normalize model name to current active models
 */
function resolveModelName(model) {
  if (!model || model === 'gemini-1.5-flash' || model === 'gemini-2.5-flash' || model === 'gemini-pro') {
    return 'gemini-3.5-flash-lite';
  }
  return model;
}

/**
 * Send a message and get a full response
 * @param {Object} options
 * @param {string} options.message - The latest user prompt
 * @param {Array} [options.history] - Array of previous messages [{role, content}]
 * @param {string} [options.model] - Model name (e.g., 'gemini-3.5-flash-lite')
 * @param {string} [options.systemInstruction] - Optional persona / system instructions
 * @param {string} [options.apiKey] - Optional custom API key
 * @returns {Promise<{ reply: string, model: string }>}
 */
async function generateChatMessage({ message, history = [], model = 'gemini-3.5-flash-lite', systemInstruction, apiKey }) {
  if (!message || typeof message !== 'string' || message.trim() === '') {
    const error = new Error('Message prompt cannot be empty.');
    error.status = 400;
    throw error;
  }

  const ai = getClient(apiKey);
  const targetModel = resolveModelName(model);

  const modelOptions = {
    model: targetModel,
  };

  if (systemInstruction && systemInstruction.trim()) {
    modelOptions.systemInstruction = systemInstruction.trim();
  }

  const formattedHistory = formatHistory(history);

  async function tryGenerate(mName) {
    const generativeModel = ai.getGenerativeModel({ ...modelOptions, model: mName });
    const chat = generativeModel.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    const result = await chat.sendMessage(message.trim());
    const response = await result.response;
    return {
      reply: response.text(),
      model: mName,
      timestamp: new Date().toISOString()
    };
  }

  try {
    return await tryGenerate(targetModel);
  } catch (err) {
    // If targetModel fails due to demand or availability, fallback to gemini-3.1-flash-lite
    if (targetModel !== 'gemini-3.1-flash-lite') {
      console.warn(`[Gemini Service]: ${targetModel} error, trying fallback model gemini-3.1-flash-lite...`);
      return await tryGenerate('gemini-3.1-flash-lite');
    }
    throw err;
  }
}

/**
 * Send a message and stream the response chunk-by-chunk
 */
async function streamChatMessage({ message, history = [], model = 'gemini-3.5-flash-lite', systemInstruction, apiKey }, onChunk) {
  if (!message || typeof message !== 'string' || message.trim() === '') {
    const error = new Error('Message prompt cannot be empty.');
    error.status = 400;
    throw error;
  }

  const ai = getClient(apiKey);
  const targetModel = resolveModelName(model);

  const modelOptions = {
    model: targetModel,
  };

  if (systemInstruction && systemInstruction.trim()) {
    modelOptions.systemInstruction = systemInstruction.trim();
  }

  const formattedHistory = formatHistory(history);

  async function tryStream(mName) {
    const generativeModel = ai.getGenerativeModel({ ...modelOptions, model: mName });
    const chat = generativeModel.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    const resultStream = await chat.sendMessageStream(message.trim());
    let fullText = '';

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      if (onChunk) {
        onChunk(chunkText);
      }
    }

    return {
      fullText,
      model: mName,
      timestamp: new Date().toISOString()
    };
  }

  try {
    return await tryStream(targetModel);
  } catch (err) {
    if (targetModel !== 'gemini-3.1-flash-lite') {
      console.warn(`[Gemini Service]: Stream on ${targetModel} failed, retrying with gemini-3.1-flash-lite...`);
      return await tryStream('gemini-3.1-flash-lite');
    }
    throw err;
  }
}

/**
 * Validate an API key by making a lightweight test call
 * @param {string} [apiKey]
 * @returns {Promise<{ valid: boolean, message: string }>}
 */
async function validateApiKey(apiKey) {
  try {
    const ai = getClient(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
    const result = await model.generateContent('Hi');
    await result.response;
    return { valid: true, message: 'Gemini API key is valid and working!' };
  } catch (err) {
    return { valid: false, message: err.message };
  }
}

module.exports = {
  AVAILABLE_MODELS,
  generateChatMessage,
  streamChatMessage,
  validateApiKey
};
