# 🤖 Gemini LLM Chatbot • Full-Stack Architecture + Supabase

A modern, responsive, and secure AI chatbot powered by Google's Gemini Large Language Models and **Supabase (PostgreSQL)** database for persistent conversation history, built with a **crystal-clear separation between Frontend and Backend**.

---

## 🏛️ Clear Differentiation: Frontend vs Backend vs Supabase

This application is purposefully decoupled into distinct layers:

```
test/
├── backend/                      <--- 🛡️ SECURE SERVER LAYER
│   ├── .env.example              # Template for backend secrets
│   ├── .env                      # Holds GEMINI_API_KEY & Supabase server credentials
│   ├── package.json              # Server dependencies (Express, @supabase/supabase-js, @google/generative-ai)
│   ├── geminiService.js          # Google Generative AI SDK wrapper
│   ├── supabaseService.js        # Supabase database query & persistence service
│   └── server.js                 # REST & SSE API server (port 3000)
│
├── frontend/                     <--- 💻 CLIENT PRESENTATION LAYER
│   ├── .env.example              # Template for public client variables
│   ├── .env                      # Client-safe Supabase & API URL variables
│   ├── index.html                # Semantic UI, modals & architecture visualizer
│   ├── style.css                 # Cosmic glassmorphic styling, animations & dark mode
│   └── app.js                    # Browser state, SSE streaming & Markdown rendering
│
├── supabase_schema.sql           <--- 1-Click SQL schema for Supabase tables & RLS
├── package.json                  <--- Root convenience scripts
├── start.bat                     <--- 1-Click Windows starter
└── README.md                     <--- Complete Documentation
```

---

## 🔐 Environment Variables (`.env`) in Frontend and Backend

The project features separate `.env` files for the backend and frontend to ensure security and clean separation:

### 1. Backend Environment: [`backend/.env`](file:///c:/Users/nalli/OneDrive/Desktop/test/backend/.env)
Contains server secrets that **must never be leaked to the client browser**:

```env
# Server Port
PORT=3000

# Google Gemini API Key (Secret - Server Only)
# Get your free key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Supabase Project URL
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Supabase Anon / Public Key
SUPABASE_ANON_KEY=eyJhbGciOi...

# Supabase Service Role Key (Optional: for backend admin operations bypassing RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Default Chat Session ID for conversation grouping
DEFAULT_SESSION_ID=default-session
```

### 2. Frontend Environment: [`frontend/.env`](file:///c:/Users/nalli/OneDrive/Desktop/test/frontend/.env)
Contains public configuration values that the client browser uses (injected automatically via `/env.js`):

```env
# Backend API Base URL
BACKEND_API_URL=http://localhost:3000

# Supabase Public Database Credentials (Safe for browser client)
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...

# Default Gemini Model
GEMINI_DEFAULT_MODEL=gemini-1.5-flash

# Application Branding
APP_NAME="Gemini Chatbot"
```

---

## 🗄️ Supabase Database Setup (30 Seconds)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Navigate to **Project Settings -> API** to copy:
   - **Project URL**
   - **anon / public key**
3. Navigate to **SQL Editor** in the left sidebar, click **New Query**, paste the contents of [`supabase_schema.sql`](file:///c:/Users/nalli/OneDrive/Desktop/test/supabase_schema.sql), and click **Run**.
4. Paste your `SUPABASE_URL` and `SUPABASE_ANON_KEY` into both [`backend/.env`](file:///c:/Users/nalli/OneDrive/Desktop/test/backend/.env) and [`frontend/.env`](file:///c:/Users/nalli/OneDrive/Desktop/test/frontend/.env).

### Database Schema Created:
- **`public.sessions`**: Stores chat sessions (`id`, `title`, timestamps).
- **`public.messages`**: Stores individual messages (`id`, `session_id`, `role`, `content`, `model`, `created_at`).
- **Row Level Security (RLS)** policies configured for read/write.

---

## 🔄 End-to-End Data Flow

```
[1. User enters prompt in UI]
             │
             ▼
[2. Frontend (/frontend/app.js)]
   • Sends prompt & sessionId to POST /api/chat/stream
             │
             ▼ (HTTP Request)
[3. Backend (/backend/server.js)]
   • Saves user message to Supabase DB (messages table)
   • Calls Gemini LLM with system prompt + history
             │
             ▼ (Encrypted TLS)
[4. Google Gemini Cloud LLM]
   • Generates tokens & streams chunks to Backend
             │
             ▼ (SSE Stream)
[5. Backend Streams Chunks to Frontend]
   • Frontend renders response word-by-word with Markdown
             │
             ▼ (On stream finish)
[6. Backend Saves Assistant Reply to Supabase DB]
   • Full conversation is persistently recorded in PostgreSQL!
```

---

## 🚀 Quick Start Guide

### Step 1: Set Your Keys
1. Get a Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Put your keys in:
   - [`backend/.env`](file:///c:/Users/nalli/OneDrive/Desktop/test/backend/.env)
   - [`frontend/.env`](file:///c:/Users/nalli/OneDrive/Desktop/test/frontend/.env)

---

### Step 2: Start the Server

#### Option A: One-Click on Windows
Double-click [`start.bat`](file:///c:/Users/nalli/OneDrive/Desktop/test/start.bat).

#### Option B: Terminal
```bash
npm start
```

---

### Step 3: Open in Browser
Visit:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔌 API Specification

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /api/status` | `GET` | Health check, Gemini key check, and Supabase status |
| `GET /api/supabase/status` | `GET` | Verifies live connectivity with Supabase database |
| `GET /api/history` | `GET` | Retrieves persistent chat history from Supabase |
| `DELETE /api/history` | `DELETE` | Clears conversation messages in Supabase and cache |
| `POST /api/chat` | `POST` | Non-streaming chat generation & automatic Supabase saving |
| `POST /api/chat/stream` | `POST` | Server-Sent Events (SSE) streaming chat & Supabase saving |
| `GET /env.js` | `GET` | Injects safe `frontend/.env` variables into `window.__ENV` |
