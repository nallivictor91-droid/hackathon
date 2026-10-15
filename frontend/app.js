/**
 * Gemini Chatbot - Frontend Client Application
 * Connects the browser UI to the Node.js backend API and Supabase database.
 */

// Safely obtain environment variables injected by /env.js from frontend/.env
const clientEnv = window.__ENV || {};

// State Management
const state = {
  backendUrl: clientEnv.BACKEND_API_URL || (
    window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? '' // Same origin when served by Express
      : 'http://localhost:3000'
  ),
  sessionId: localStorage.getItem('gemini_session_id') || 'default-session',
  messages: [],
  hasServerKey: false,
  supabaseConfigured: false,
  apiKey: localStorage.getItem('gemini_custom_key') || '',
  supabaseUrl: localStorage.getItem('supabase_custom_url') || clientEnv.SUPABASE_URL || '',
  supabaseKey: localStorage.getItem('supabase_custom_key') || clientEnv.SUPABASE_ANON_KEY || '',
  selectedModel: localStorage.getItem('gemini_model') || clientEnv.GEMINI_DEFAULT_MODEL || 'gemini-3.5-flash-lite',
  selectedPersona: localStorage.getItem('gemini_persona') || 'helpful',
  customInstruction: localStorage.getItem('gemini_custom_instruction') || '',
  isStreaming: true,
  isGenerating: false,
};

// Persona Prompts
const PERSONA_INSTRUCTIONS = {
  helpful: 'You are a friendly, highly intelligent, and helpful AI assistant powered by Google Gemini. Provide clear, accurate, and insightful answers.',
  developer: 'You are a distinguished Senior Full-Stack Software Engineer and System Architect. Provide robust, clean, modern code solutions with clear explanations, best practices, and edge case handling.',
  concise: 'You are an ultra-concise assistant. Give direct, factual answers without unnecessary greetings, preamble, or filler words.',
  tutor: 'You are a warm and patient Socratic tutor. Guide the user step-by-step through concepts using clear examples and thoughtful questions.',
  custom: ''
};

// DOM Elements
const elements = {
  // Status & Badges
  currentModelBadge: document.getElementById('currentModelBadge'),
  currentModelName: document.getElementById('currentModelName'),
  archPipelinePill: document.getElementById('archPipelinePill'),
  stepFrontend: document.getElementById('stepFrontend'),
  stepBackend: document.getElementById('stepBackend'),
  stepSupabase: document.getElementById('stepSupabase'),
  stepGemini: document.getElementById('stepGemini'),
  apiKeyStatusBanner: document.getElementById('apiKeyStatusBanner'),
  bannerStatusPulse: document.getElementById('bannerStatusPulse'),
  bannerStatusTitle: document.getElementById('bannerStatusTitle'),
  bannerStatusText: document.getElementById('bannerStatusText'),
  bannerConfigActionBtn: document.getElementById('bannerConfigActionBtn'),

  // Supabase Banner & Indicators
  supabaseStatusBanner: document.getElementById('supabaseStatusBanner'),
  supabaseStatusPulse: document.getElementById('supabaseStatusPulse'),
  supabaseStatusTitle: document.getElementById('supabaseStatusTitle'),
  supabaseStatusText: document.getElementById('supabaseStatusText'),
  bannerSupabaseActionBtn: document.getElementById('bannerSupabaseActionBtn'),
  dbSyncIndicator: document.getElementById('dbSyncIndicator'),
  dbSyncText: document.getElementById('dbSyncText'),

  // Chat Views
  welcomeScreen: document.getElementById('welcomeScreen'),
  messagesList: document.getElementById('messagesList'),
  chatContainer: document.getElementById('chatContainer'),
  chatForm: document.getElementById('chatForm'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  sendSpinner: document.getElementById('sendSpinner'),
  charCount: document.getElementById('charCount'),
  streamToggle: document.getElementById('streamToggle'),
  activePersonaTag: document.getElementById('activePersonaTag'),
  transitBar: document.getElementById('transitBar'),
  transitLabel: document.getElementById('transitLabel'),

  // Modals & Controls
  archModal: document.getElementById('archModal'),
  archModalBtn: document.getElementById('archModalBtn'),
  closeArchModal: document.getElementById('closeArchModal'),
  ackArchBtn: document.getElementById('ackArchBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsBtn: document.getElementById('settingsBtn'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),

  // Settings Form
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
  testApiKeyBtn: document.getElementById('testApiKeyBtn'),
  keyValidationResult: document.getElementById('keyValidationResult'),
  supabaseUrlInput: document.getElementById('supabaseUrlInput'),
  supabaseKeyInput: document.getElementById('supabaseKeyInput'),
  testSupabaseBtn: document.getElementById('testSupabaseBtn'),
  supabaseValidationResult: document.getElementById('supabaseValidationResult'),
  modelSelect: document.getElementById('modelSelect'),
  personaSelect: document.getElementById('personaSelect'),
  customInstructionGroup: document.getElementById('customInstructionGroup'),
  customInstructionInput: document.getElementById('customInstructionInput'),
  toastContainer: document.getElementById('toastContainer')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupMarkdownRenderer();
  bindEventListeners();
  loadSavedPreferences();
  await checkBackendStatus();
  await checkSupabaseStatus();
  await loadChatHistoryFromDatabase();
});

/**
 * Configure Markdown parser and syntax highlighter
 */
function setupMarkdownRenderer() {
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (e) {
            console.error('Highlight.js error:', e);
          }
        }
        return code;
      },
      breaks: true,
      gfm: true
    });
  }
}

/**
 * Load user preferences from localStorage and window.__ENV
 */
function loadSavedPreferences() {
  if (state.apiKey) {
    elements.apiKeyInput.value = state.apiKey;
  }
  if (state.supabaseUrl) {
    elements.supabaseUrlInput.value = state.supabaseUrl;
  }
  if (state.supabaseKey) {
    elements.supabaseKeyInput.value = state.supabaseKey;
  }

  elements.modelSelect.value = state.selectedModel;
  elements.currentModelName.textContent = state.selectedModel;
  elements.personaSelect.value = state.selectedPersona;
  elements.customInstructionInput.value = state.customInstruction;
  
  if (state.selectedPersona === 'custom') {
    elements.customInstructionGroup.style.display = 'flex';
  }

  const personaLabels = {
    helpful: 'Helpful Assistant',
    developer: 'Senior Engineer',
    concise: 'Concise Mode',
    tutor: 'Socratic Tutor',
    custom: 'Custom Persona'
  };
  elements.activePersonaTag.textContent = personaLabels[state.selectedPersona] || 'Helpful Assistant';
}

/**
 * Check backend connectivity and configuration
 */
async function checkBackendStatus() {
  try {
    const res = await fetch(`${state.backendUrl}/api/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.hasServerKey = Boolean(data.hasApiKey);
    state.supabaseConfigured = Boolean(data.supabase?.configured);

    // Update Gemini Status
    if (state.hasServerKey || state.apiKey) {
      elements.bannerStatusPulse.className = 'status-pulse connected';
      elements.bannerStatusTitle.textContent = 'Gemini LLM Ready';
      elements.bannerStatusText.textContent = state.hasServerKey
        ? 'Using GEMINI_API_KEY from backend/.env configuration.'
        : 'Using custom client API key stored in local session.';
      elements.bannerConfigActionBtn.textContent = 'Change Key';
      setPipelineStepStatus('stepBackend', 'connected');
      setPipelineStepStatus('stepGemini', 'connected');
    } else {
      elements.bannerStatusPulse.className = 'status-pulse';
      elements.bannerStatusTitle.textContent = 'Backend Online (Gemini Key Needed)';
      elements.bannerStatusText.textContent = 'Add GEMINI_API_KEY to backend/.env or click Configure Key.';
      elements.bannerConfigActionBtn.textContent = 'Configure Key';
      setPipelineStepStatus('stepBackend', 'connected');
      setPipelineStepStatus('stepGemini', 'waiting');
    }
  } catch (err) {
    console.error('Failed to connect to backend:', err);
    elements.bannerStatusPulse.className = 'status-pulse error';
    elements.bannerStatusTitle.textContent = 'Backend Server Offline';
    elements.bannerStatusText.textContent = 'Could not reach Node.js server at port 3000. Start backend with npm start.';
    elements.bannerConfigActionBtn.textContent = 'Retry Connection';
    setPipelineStepStatus('stepBackend', 'error');
    setPipelineStepStatus('stepGemini', 'error');
  }
}

/**
 * Check Supabase database connectivity
 */
async function checkSupabaseStatus() {
  const syncDot = elements.dbSyncIndicator.querySelector('.sync-dot');

  try {
    const res = await fetch(`${state.backendUrl}/api/supabase/status`);
    const data = await res.json();

    if (data.connected) {
      elements.supabaseStatusPulse.className = 'status-pulse connected';
      elements.supabaseStatusTitle.textContent = 'Supabase Database Connected';
      elements.supabaseStatusText.textContent = 'Chat history is automatically saved to your PostgreSQL database.';
      elements.bannerSupabaseActionBtn.textContent = 'DB Settings';
      setPipelineStepStatus('stepSupabase', 'connected');
      syncDot.classList.add('synced');
      elements.dbSyncText.textContent = 'Supabase Active';
    } else if (data.configured && data.needsSchema) {
      elements.supabaseStatusPulse.className = 'status-pulse';
      elements.supabaseStatusTitle.textContent = 'Supabase Connected (Needs Schema)';
      elements.supabaseStatusText.textContent = 'Connected, but "messages" table is missing. Run supabase_schema.sql in Supabase SQL editor.';
      elements.bannerSupabaseActionBtn.textContent = 'Setup Schema';
      setPipelineStepStatus('stepSupabase', 'waiting');
      elements.dbSyncText.textContent = 'Needs Schema';
    } else {
      elements.supabaseStatusPulse.className = 'status-pulse';
      elements.supabaseStatusTitle.textContent = 'Supabase DB Not Configured';
      elements.supabaseStatusText.textContent = 'Set SUPABASE_URL & SUPABASE_ANON_KEY in backend/.env and frontend/.env.';
      elements.bannerSupabaseActionBtn.textContent = 'Connect DB';
      setPipelineStepStatus('stepSupabase', 'waiting');
      elements.dbSyncText.textContent = 'In-Memory Cache';
    }
  } catch (err) {
    elements.supabaseStatusPulse.className = 'status-pulse error';
    elements.supabaseStatusTitle.textContent = 'Supabase Status Unavailable';
    elements.supabaseStatusText.textContent = 'Could not check Supabase connection from backend.';
    setPipelineStepStatus('stepSupabase', 'waiting');
  }
}

/**
 * Load persistent chat history from Supabase database
 */
async function loadChatHistoryFromDatabase() {
  try {
    const res = await fetch(`${state.backendUrl}/api/history?sessionId=${encodeURIComponent(state.sessionId)}`);
    if (!res.ok) return;
    const data = await res.json();

    if (Array.isArray(data.messages) && data.messages.length > 0) {
      state.messages = data.messages.map(m => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      // Render retrieved messages
      elements.welcomeScreen.style.display = 'none';
      elements.messagesList.style.display = 'flex';
      elements.messagesList.innerHTML = '';

      state.messages.forEach(msg => {
        appendMessage({ role: msg.role, content: msg.content });
      });

      scrollToBottom();
      showToast(`Loaded ${state.messages.length} messages from Supabase`, 'info');
    }
  } catch (e) {
    console.warn('Could not load history from database:', e);
  }
}

/**
 * Update visual indicator for architecture steps
 */
function setPipelineStepStatus(stepId, status) {
  const step = elements[stepId];
  if (!step) return;
  step.classList.remove('active', 'waiting', 'error', 'connected');
  if (status) step.classList.add(status);
}

/**
 * Bind UI Event Listeners
 */
function bindEventListeners() {
  // Input auto-growth & character counter
  elements.messageInput.addEventListener('input', () => {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 180) + 'px';
    elements.charCount.textContent = `${elements.messageInput.value.length} characters`;
  });

  // Enter to send (Shift+Enter for newline)
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Chat Form Submit
  elements.chatForm.addEventListener('submit', handleSendMessage);

  // Suggestions cards
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) {
        elements.messageInput.value = prompt;
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 180) + 'px';
        elements.messageInput.focus();
        elements.chatForm.dispatchEvent(new Event('submit'));
      }
    });
  });

  // Clear Chat Button (Clears UI and Supabase)
  elements.clearChatBtn.addEventListener('click', async () => {
    if (state.messages.length === 0) return;
    if (confirm('Are you sure you want to clear conversation history from UI and Supabase?')) {
      try {
        await fetch(`${state.backendUrl}/api/history?sessionId=${encodeURIComponent(state.sessionId)}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn('Could not delete history in backend:', e);
      }
      state.messages = [];
      elements.messagesList.innerHTML = '';
      elements.messagesList.style.display = 'none';
      elements.welcomeScreen.style.display = 'flex';
      showToast('Conversation cleared from database & UI', 'success');
    }
  });

  // Modals Toggles
  elements.archPipelinePill.addEventListener('click', () => showModal(elements.archModal));
  elements.archModalBtn.addEventListener('click', () => showModal(elements.archModal));
  elements.closeArchModal.addEventListener('click', () => hideModal(elements.archModal));
  elements.ackArchBtn.addEventListener('click', () => hideModal(elements.archModal));

  elements.settingsBtn.addEventListener('click', () => showModal(elements.settingsModal));
  elements.bannerConfigActionBtn.addEventListener('click', () => showModal(elements.settingsModal));
  elements.bannerSupabaseActionBtn.addEventListener('click', () => showModal(elements.settingsModal));
  elements.closeSettingsModal.addEventListener('click', () => hideModal(elements.settingsModal));
  elements.cancelSettingsBtn.addEventListener('click', () => hideModal(elements.settingsModal));

  // Toggle API Key visibility
  elements.toggleApiKeyVisibility.addEventListener('click', () => {
    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.toggleApiKeyVisibility.textContent = isPassword ? '🔒' : '👁️';
  });

  // Test Buttons
  elements.testApiKeyBtn.addEventListener('click', testApiKey);
  elements.testSupabaseBtn.addEventListener('click', testSupabaseConnection);

  // Persona select change
  elements.personaSelect.addEventListener('change', () => {
    if (elements.personaSelect.value === 'custom') {
      elements.customInstructionGroup.style.display = 'flex';
    } else {
      elements.customInstructionGroup.style.display = 'none';
    }
  });

  // Save Settings Button
  elements.saveSettingsBtn.addEventListener('click', saveSettings);

  // Close modals on clicking backdrop
  [elements.archModal, elements.settingsModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal(modal);
    });
  });
}

function showModal(modal) {
  modal.style.display = 'flex';
}

function hideModal(modal) {
  modal.style.display = 'none';
  elements.keyValidationResult.style.display = 'none';
  elements.supabaseValidationResult.style.display = 'none';
}

/**
 * Test an API key via backend validator
 */
async function testApiKey() {
  const keyToTest = elements.apiKeyInput.value.trim();
  elements.testApiKeyBtn.disabled = true;
  elements.testApiKeyBtn.textContent = 'Testing...';
  elements.keyValidationResult.style.display = 'none';

  try {
    const res = await fetch(`${state.backendUrl}/api/validate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: keyToTest })
    });
    const data = await res.json();

    elements.keyValidationResult.style.display = 'block';
    if (res.ok && data.valid) {
      elements.keyValidationResult.className = 'validation-result success';
      elements.keyValidationResult.textContent = '✅ Key is valid! Connected to Gemini API successfully.';
    } else {
      elements.keyValidationResult.className = 'validation-result error';
      elements.keyValidationResult.textContent = `❌ Validation Failed: ${data.message || 'Invalid API Key'}`;
    }
  } catch (err) {
    elements.keyValidationResult.style.display = 'block';
    elements.keyValidationResult.className = 'validation-result error';
    elements.keyValidationResult.textContent = `❌ Network Error: Could not reach backend server.`;
  } finally {
    elements.testApiKeyBtn.disabled = false;
    elements.testApiKeyBtn.textContent = 'Test Key';
  }
}

/**
 * Test Supabase database connection
 */
async function testSupabaseConnection() {
  elements.testSupabaseBtn.disabled = true;
  elements.testSupabaseBtn.textContent = 'Testing DB...';
  elements.supabaseValidationResult.style.display = 'none';

  try {
    const res = await fetch(`${state.backendUrl}/api/supabase/status`);
    const data = await res.json();

    elements.supabaseValidationResult.style.display = 'block';
    if (data.connected) {
      elements.supabaseValidationResult.className = 'validation-result success';
      elements.supabaseValidationResult.textContent = '✅ ' + data.message;
    } else if (data.needsSchema) {
      elements.supabaseValidationResult.className = 'validation-result error';
      elements.supabaseValidationResult.textContent = '⚠️ ' + data.message;
    } else {
      elements.supabaseValidationResult.className = 'validation-result error';
      elements.supabaseValidationResult.textContent = '❌ ' + (data.message || 'Could not connect to Supabase.');
    }
  } catch (err) {
    elements.supabaseValidationResult.style.display = 'block';
    elements.supabaseValidationResult.className = 'validation-result error';
    elements.supabaseValidationResult.textContent = '❌ Could not reach backend to test Supabase.';
  } finally {
    elements.testSupabaseBtn.disabled = false;
    elements.testSupabaseBtn.textContent = 'Test DB';
  }
}

/**
 * Save configuration settings
 */
function saveSettings() {
  const newApiKey = elements.apiKeyInput.value.trim();
  const newSupabaseUrl = elements.supabaseUrlInput.value.trim();
  const newSupabaseKey = elements.supabaseKeyInput.value.trim();
  const newModel = elements.modelSelect.value;
  const newPersona = elements.personaSelect.value;
  const newCustomInstruction = elements.customInstructionInput.value.trim();

  state.apiKey = newApiKey;
  state.supabaseUrl = newSupabaseUrl;
  state.supabaseKey = newSupabaseKey;
  state.selectedModel = newModel;
  state.selectedPersona = newPersona;
  state.customInstruction = newCustomInstruction;

  localStorage.setItem('gemini_custom_key', newApiKey);
  localStorage.setItem('supabase_custom_url', newSupabaseUrl);
  localStorage.setItem('supabase_custom_key', newSupabaseKey);
  localStorage.setItem('gemini_model', newModel);
  localStorage.setItem('gemini_persona', newPersona);
  localStorage.setItem('gemini_custom_instruction', newCustomInstruction);

  elements.currentModelName.textContent = newModel;

  const personaLabels = {
    helpful: 'Helpful Assistant',
    developer: 'Senior Engineer',
    concise: 'Concise Mode',
    tutor: 'Socratic Tutor',
    custom: 'Custom Persona'
  };
  elements.activePersonaTag.textContent = personaLabels[newPersona] || 'Helpful Assistant';

  hideModal(elements.settingsModal);
  showToast('Settings saved successfully', 'success');
  checkBackendStatus();
  checkSupabaseStatus();
}

/**
 * Handle sending user message
 */
async function handleSendMessage(e) {
  e.preventDefault();
  const messageText = elements.messageInput.value.trim();
  if (!messageText || state.isGenerating) return;

  // Ensure welcome screen is hidden and messages list is visible
  elements.welcomeScreen.style.display = 'none';
  elements.messagesList.style.display = 'flex';

  // Append user message to UI
  appendMessage({ role: 'user', content: messageText });
  state.messages.push({ role: 'user', content: messageText });

  // Reset Input
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
  elements.charCount.textContent = '0 characters';
  scrollToBottom();

  // Determine system instruction
  let systemInstruction = PERSONA_INSTRUCTIONS[state.selectedPersona] || '';
  if (state.selectedPersona === 'custom') {
    systemInstruction = state.customInstruction;
  }

  // Set generating state
  setGenerating(true);
  startTransitAnimation();

  // Prepare payload including sessionId for Supabase persistence
  const payload = {
    message: messageText,
    history: state.messages.slice(0, -1),
    model: state.selectedModel,
    systemInstruction,
    sessionId: state.sessionId
  };

  const headers = {
    'Content-Type': 'application/json'
  };
  if (state.apiKey) {
    headers['x-gemini-api-key'] = state.apiKey;
  }

  const useStreaming = elements.streamToggle.checked;

  try {
    if (useStreaming) {
      await executeStreamingChat(payload, headers);
    } else {
      await executeStandardChat(payload, headers);
    }
  } catch (error) {
    console.error('Chat generation error:', error);
    appendErrorMessage(error.message || 'An error occurred while generating response.');
    showToast(error.message || 'Error communicating with backend', 'error');
  } finally {
    setGenerating(false);
    stopTransitAnimation();
    scrollToBottom();
  }
}

/**
 * Streaming Chat Request (Server-Sent Events)
 */
async function executeStreamingChat(payload, headers) {
  const response = await fetch(`${state.backendUrl}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || `Server responded with status ${response.status}`);
  }

  // Create empty assistant bubble in UI
  const { bubbleElement, updateContent, finalize } = createStreamingAssistantBubble();

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.chunk) {
            accumulatedText += parsed.chunk;
            updateContent(accumulatedText);
            scrollToBottom();
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) {
            throw e;
          }
        }
      }
    }
  }

  finalize(accumulatedText);
  state.messages.push({ role: 'assistant', content: accumulatedText });
}

/**
 * Standard Non-Streaming Chat Request
 */
async function executeStandardChat(payload, headers) {
  const response = await fetch(`${state.backendUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Server responded with status ${response.status}`);
  }

  appendMessage({ role: 'assistant', content: data.reply, model: data.model });
  state.messages.push({ role: 'assistant', content: data.reply });
}

/**
 * Append complete message card to UI
 */
function appendMessage({ role, content, model }) {
  const messageRow = document.createElement('div');
  messageRow.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = role === 'user' ? '👤' : '✨';

  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.className = 'message-bubble-wrapper';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.innerHTML = role === 'user'
    ? `<span>You</span> • <span>${timeStr}</span>`
    : `<span>Gemini (${model || state.selectedModel})</span> • <span>${timeStr}</span>`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMarkdown(content);

  // Message Action Bar
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.innerHTML = `
    <button class="msg-action-btn copy-msg-btn" title="Copy response">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    </button>
  `;

  actions.querySelector('.copy-msg-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(content).then(() => {
      showToast('Copied to clipboard', 'success');
    });
  });

  bubbleWrapper.appendChild(meta);
  bubbleWrapper.appendChild(bubble);
  if (role === 'assistant') {
    bubbleWrapper.appendChild(actions);
  }

  messageRow.appendChild(avatar);
  messageRow.appendChild(bubbleWrapper);

  elements.messagesList.appendChild(messageRow);
  attachCodeCopyButtons(bubble);
}

/**
 * Create a live streaming assistant bubble
 */
function createStreamingAssistantBubble() {
  const messageRow = document.createElement('div');
  messageRow.className = 'message-row assistant';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = '✨';

  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.className = 'message-bubble-wrapper';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.innerHTML = `<span>Gemini (${state.selectedModel})</span> • <span>${timeStr}</span>`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = '<span class="streaming-cursor"></span>';

  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.style.display = 'none';
  actions.innerHTML = `
    <button class="msg-action-btn copy-msg-btn" title="Copy response">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    </button>
  `;

  bubbleWrapper.appendChild(meta);
  bubbleWrapper.appendChild(bubble);
  bubbleWrapper.appendChild(actions);

  messageRow.appendChild(avatar);
  messageRow.appendChild(bubbleWrapper);
  elements.messagesList.appendChild(messageRow);

  return {
    bubbleElement: bubble,
    updateContent: (text) => {
      bubble.innerHTML = formatMarkdown(text) + '<span class="streaming-cursor"></span>';
      attachCodeCopyButtons(bubble);
    },
    finalize: (finalText) => {
      bubble.innerHTML = formatMarkdown(finalText);
      attachCodeCopyButtons(bubble);
      actions.style.display = 'flex';
      actions.querySelector('.copy-msg-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(finalText).then(() => {
          showToast('Copied to clipboard', 'success');
        });
      });
    }
  };
}

/**
 * Append error message bubble with quick remedy instructions
 */
function appendErrorMessage(errorText) {
  const messageRow = document.createElement('div');
  messageRow.className = 'message-row assistant';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.style.background = 'rgba(239, 68, 68, 0.2)';
  avatar.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  avatar.innerHTML = '⚠️';

  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.className = 'message-bubble-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.style.borderColor = 'rgba(239, 68, 68, 0.3)';
  bubble.style.background = 'rgba(239, 68, 68, 0.08)';

  bubble.innerHTML = `
    <p style="color: #fca5a5; font-weight: 600; margin-bottom: 0.4rem;">⚠️ Request Failed</p>
    <p style="color: #e2e8f0; font-size: 0.88rem;">${escapeHtml(errorText)}</p>
    <div style="margin-top: 0.75rem;">
      <button class="btn btn-sm btn-primary" onclick="document.getElementById('settingsBtn').click()">
        Open Configuration Settings
      </button>
    </div>
  `;

  bubbleWrapper.appendChild(bubble);
  messageRow.appendChild(avatar);
  messageRow.appendChild(bubbleWrapper);
  elements.messagesList.appendChild(messageRow);
}

/**
 * Format markdown string safely
 */
function formatMarkdown(rawText) {
  if (typeof marked !== 'undefined') {
    try {
      return marked.parse(rawText);
    } catch (e) {
      console.error('Marked parsing error:', e);
    }
  }
  return escapeHtml(rawText).replace(/\n/g, '<br>');
}

/**
 * Attach copy buttons to rendered code blocks
 */
function attachCodeCopyButtons(container) {
  const preElements = container.querySelectorAll('pre');
  preElements.forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const code = pre.querySelector('code');
    let lang = 'code';
    if (code && code.className) {
      const match = code.className.match(/language-(\w+)/);
      if (match) lang = match[1];
    }

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="code-copy-btn">Copy code</button>
    `;

    header.querySelector('.code-copy-btn').addEventListener('click', () => {
      const textToCopy = code ? code.innerText : pre.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Code copied to clipboard', 'success');
      });
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

/**
 * Set generation UI state
 */
function setGenerating(isGen) {
  state.isGenerating = isGen;
  elements.sendBtn.disabled = isGen;
  elements.sendBtn.querySelector('.send-icon').style.display = isGen ? 'none' : 'block';
  elements.sendSpinner.style.display = isGen ? 'block' : 'none';
}

/**
 * Animate the pipeline transit bar during network exchange
 */
function startTransitAnimation() {
  elements.transitBar.style.display = 'flex';
  setPipelineStepStatus('stepFrontend', 'active');
  setPipelineStepStatus('stepBackend', 'active');
  setPipelineStepStatus('stepSupabase', 'active');
  setPipelineStepStatus('stepGemini', 'active');
}

function stopTransitAnimation() {
  elements.transitBar.style.display = 'none';
  setPipelineStepStatus('stepFrontend', 'connected');
  setPipelineStepStatus('stepBackend', 'connected');
  setPipelineStepStatus('stepSupabase', state.supabaseConfigured ? 'connected' : 'waiting');
  setPipelineStepStatus('stepGemini', (state.hasServerKey || state.apiKey) ? 'connected' : 'waiting');
}

function scrollToBottom() {
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Display toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
