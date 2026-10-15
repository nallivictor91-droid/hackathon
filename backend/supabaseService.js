const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Database Service
 * Provides structured persistence for chat messages and sessions.
 * Gracefully falls back to in-memory store if credentials are not configured yet.
 */

// In-memory fallback storage
const inMemoryHistory = new Map();

/**
 * Helper to check if string is a valid non-placeholder value
 */
function isValidValue(val) {
  return (
    val &&
    typeof val === 'string' &&
    val.trim() !== '' &&
    !val.includes('YOUR_SUPABASE') &&
    !val.includes('placeholder')
  );
}

/**
 * Check if Supabase environment variables are properly set
 */
function isConfigured() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return isValidValue(url) && isValidValue(key);
}

/**
 * Get an initialized Supabase Client
 */
function getClient() {
  if (!isConfigured()) return null;

  const url = process.env.SUPABASE_URL.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY).trim();

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Test connectivity with the Supabase database
 */
async function testConnection() {
  if (!isConfigured()) {
    return {
      configured: false,
      connected: false,
      message: 'Supabase credentials are not configured in backend/.env'
    };
  }

  try {
    const supabase = getClient();
    // Test query against messages table
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1);

    if (error) {
      // If table does not exist yet
      if (error.code === '42P01') {
        return {
          configured: true,
          connected: false,
          needsSchema: true,
          message: 'Connected to Supabase, but "messages" table is missing. Run supabase_schema.sql in Supabase SQL editor.'
        };
      }
      return {
        configured: true,
        connected: false,
        message: `Supabase query error: ${error.message} (${error.code})`
      };
    }

    return {
      configured: true,
      connected: true,
      message: 'Successfully connected to Supabase database!'
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      message: `Failed to connect to Supabase: ${err.message}`
    };
  }
}

/**
 * Ensure a session row exists in the database
 */
async function ensureSession(supabase, sessionId) {
  try {
    await supabase
      .from('sessions')
      .upsert({ id: sessionId, title: 'Chat Session' }, { onConflict: 'id' });
  } catch (e) {
    // Non-fatal if sessions table does not exist or fails
  }
}

/**
 * Save a message to Supabase (or in-memory fallback)
 */
async function saveMessage({ sessionId = 'default-session', role, content, model = 'gemini-1.5-flash' }) {
  const normRole = role === 'assistant' ? 'model' : role;
  const messageObj = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    session_id: sessionId,
    role: normRole,
    content,
    model,
    created_at: new Date().toISOString()
  };

  // Always update in-memory cache for speed
  if (!inMemoryHistory.has(sessionId)) {
    inMemoryHistory.set(sessionId, []);
  }
  inMemoryHistory.get(sessionId).push(messageObj);

  // If Supabase is configured, write to database
  if (isConfigured()) {
    try {
      const supabase = getClient();
      await ensureSession(supabase, sessionId);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          role: normRole,
          content,
          model,
          created_at: messageObj.created_at
        })
        .select()
        .single();

      if (error) {
        console.warn('[Supabase Warning]: Could not persist message to database:', error.message);
      } else if (data) {
        return data;
      }
    } catch (err) {
      console.warn('[Supabase Error]: Could not insert message:', err.message);
    }
  }

  return messageObj;
}

/**
 * Get all messages for a session (ordered chronologically)
 */
async function getMessages(sessionId = 'default-session') {
  if (isConfigured()) {
    try {
      const supabase = getClient();
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        // Sync in-memory cache
        inMemoryHistory.set(sessionId, data);
        return data;
      }
    } catch (err) {
      console.warn('[Supabase Warning]: Could not fetch messages from DB, using fallback cache:', err.message);
    }
  }

  // Return fallback in-memory history
  return inMemoryHistory.get(sessionId) || [];
}

/**
 * Clear all messages for a session
 */
async function clearHistory(sessionId = 'default-session') {
  inMemoryHistory.set(sessionId, []);

  if (isConfigured()) {
    try {
      const supabase = getClient();
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.warn('[Supabase Warning]: Failed to delete messages in DB:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase Error]: Failed to clear history in DB:', err.message);
    }
  }

  return { success: true };
}

module.exports = {
  isConfigured,
  testConnection,
  saveMessage,
  getMessages,
  clearHistory
};
