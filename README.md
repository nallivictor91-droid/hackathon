# ⚡ PulseFlow AI — Autonomous Workflow Orchestrator & AI Automation Engine

> **Production-Grade, Multi-Tenant AI Smart Automation SaaS Platform powered by Google GenAI (`gemini-2.5-flash` & `gemini-2.5-pro`), Express + TypeScript backend, React 19 + Tailwind CSS frontend, and Supabase (PostgreSQL 15+) persistence.**

---

## 🏛️ Clear Differentiation: Frontend vs Backend vs Database vs AI Engine

PulseFlow AI enforces a **strict, decoupled multi-tier architecture** with unambiguous physical boundaries, isolated execution runtimes, and segregated security domains:

```
test/
├── backend/                               <--- 🛡️ SECURE ORCHESTRATION SERVER LAYER
│   ├── .env.example                       # Template for server-only secrets
│   ├── .env                               # Holds GEMINI_API_KEY & SUPABASE_SERVICE_ROLE_KEY
│   ├── package.json                       # Backend dependencies (Express, @google/genai, Zod, Helmet)
│   ├── tsconfig.json                      # Node.js TypeScript configuration
│   └── src/
│       ├── types/index.ts                 # Canonical domain models, node schemas & Zod validators
│       ├── db/supabase.ts                 # Resilient database adapter with in-memory fallback
│       ├── services/
│       │   ├── geminiService.ts           # Official @google/genai SDK with self-correcting retry loop
│       │   ├── pipelineExecutor.ts        # Autonomous multi-step workflow orchestrator & SSE events
│       │   └── dispatcherService.ts       # External dispatch integrations (Slack, CRM, Webhooks)
│       ├── routes/                        # Edge-ready Express REST endpoints
│       │   ├── health.ts                  # Diagnostics, uptime & live Gemini benchmark
│       │   ├── workflows.ts               # Workflow CRUD, duplicate & execution triggers
│       │   ├── executions.ts              # Step trace telemetry & latency waterfalls
│       │   ├── hitl.ts                    # Human-In-The-Loop review queue, diffs & resumption
│       │   ├── telemetry.ts               # KPIs, failure heatmaps & real-time SSE stream
│       │   ├── webhooks.ts                # Inbound HTTP POST payload ingestion gateway
│       │   ├── integrations.ts            # Dispatches audit vault
│       │   └── documents.ts               # Multimodal document parsing with Gemini 2.5 Pro
│       └── server.ts                      # Express API Gateway on Port 5000 (Helmet, CORS, Rate Limit)
│
├── frontend/                              <--- 💻 CLIENT PRESENTATION LAYER
│   ├── .env.example                       # Template for client-safe public variables
│   ├── .env                               # Public configuration (VITE_API_BASE_URL, VITE_APP_NAME)
│   ├── package.json                       # React 19, Vite, Tailwind CSS v4, Lucide, Zustand
│   ├── vite.config.ts                     # Vite config with /api reverse proxy to Port 5000
│   ├── index.html                         # Semantic HTML5 shell with Inter typography
│   └── src/
│       ├── api/client.ts                  # Typed REST & SSE API consumer
│       ├── store/useStore.ts              # Zustand global reactive state & modal management
│       ├── types/index.ts                 # Client data models matching backend contracts
│       ├── components/
│       │   ├── Navbar.tsx                 # Header with live gateway status & architecture trigger
│       │   ├── Dashboard.tsx              # Executive telemetry, MTTE gauge, failure heatmap
│       │   ├── WorkflowBuilder.tsx        # Visual sequential node canvas & rule editor
│       │   ├── ExecutionTraces.tsx        # Waterfall latency timeline & token breakdown
│       │   ├── HitlInbox.tsx              # Pending review queue & side-by-side visual diff
│       │   ├── TestingStudio.tsx          # 1-Click presets, cURL generator & document uploader
│       │   ├── IntegrationsHub.tsx        # Slack, CRM & Webhook dispatch audit viewer
│       │   └── ArchitectureModal.tsx      # Interactive Multi-Tier Separation Visualizer
│       ├── index.css                      # Modern dark-mode styling with Tailwind v4
│       └── App.tsx                        # Master layout & QueryClient provider
│
├── supabase_schema.sql                    <--- 🗄️ Supabase PostgreSQL 15+ Schema Migration & RLS
├── package.json                           <--- Root convenience workspace runner
└── start.bat                              <--- 1-Click Windows Decoupled Launcher
```

---

## 🔒 Security & Separation Boundaries Matrix

| Boundary Dimension | 💻 Frontend Presentation Layer | 🛡️ Backend Orchestration Layer |
| :--- | :--- | :--- |
| **Network & Port** | `http://localhost:5173` (Vite Dev Server) | `http://localhost:5000` (Express API) |
| **Execution Runtime** | Browser Chromium / V8 sandbox | Node.js v24+ (`tsx` TypeScript engine) |
| **Secrets & Keys** | **ZERO private keys.** Only safe `VITE_` public variables | Exclusively holds `GEMINI_API_KEY` & `SUPABASE_SERVICE_ROLE_KEY` |
| **AI / LLM Access** | **Never calls Google GenAI directly.** Consumes sanitized API routes | Calls official `@google/genai` with strict Zod schema validation |
| **Traffic Control** | Browser event loop & TanStack React Query cache | Rate limiting (`express-rate-limit`), Helmet security headers, CORS |
| **Database Access** | Public Supabase Client (RLS protected) | Service Role client + In-memory hybrid fallback for 100% uptime |

---

## 🚀 Quick Start (1-Click or Manual)

### Option 1: 1-Click Windows Launcher
Double-click [`start.bat`](file:///c:/Users/nalli/OneDrive/Desktop/test/start.bat) in the root directory. It automatically:
1. Spawns the Backend Orchestrator on **Port 5000** in a dedicated window.
2. Spawns the Frontend Vite Dev Server on **Port 5173** in a dedicated window.
3. Opens `http://localhost:5173` in your default browser.

### Option 2: Manual Terminal Startup

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run start
# Server listens on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# Vite client ready on http://localhost:5173
```

---

## 🌐 Endpoints Reference (`http://localhost:5000/api`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System diagnostics, uptime, and layer connection status |
| `POST` | `/health/test-gemini` | Live benchmark query testing Google GenAI SDK |
| `GET` | `/telemetry/stats` | Aggregated KPIs: Total Runs, MTTE, Spend, Failure Heatmap |
| `GET` | `/telemetry/stream` | Server-Sent Events (SSE) stream for real-time live events |
| `GET` | `/workflows` | List all configured workflow pipelines |
| `POST` | `/workflows` | Create new multi-step workflow pipeline |
| `POST` | `/workflows/:id/execute` | Execute workflow with JSON payload or document parts |
| `POST` | `/webhooks/:token` | Inbound HTTP POST webhook ingestion gateway |
| `GET` | `/executions` | Historical execution runs with status and latency |
| `GET` | `/executions/:id` | Deep step waterfall trace with token spend breakdown |
| `GET` | `/hitl/pending` | Human-In-The-Loop pending review queue |
| `POST` | `/hitl/:id/action` | Approve (with modified payload & resume) or Reject |
| `POST` | `/documents/extract` | Multipart upload (PDF/PNG) for Gemini 2.5 Pro extraction |
| `GET` | `/integrations/dispatches` | Audit log of outbound Slack, CRM, and Webhook dispatches |

---

## 🧠 Key Features Implemented

1. **Visual Rule & Workflow Builder**:
   - Multi-step trigger-action-decision sequences: Webhook, Manual, Document, Scheduled.
   - Logic nodes: Context Enriched Extraction, Semantic Classifier, Multi-criteria Router, HITL Review Node, External Action Dispatcher.
2. **Gemini 2.5 Structured Outputs & Self-Correction**:
   - Schema enforcement using `@google/genai` SDK with `gemini-2.5-flash` (fast routing) and `gemini-2.5-pro` (deep context & documents).
   - Real-time automatic retry loop with error feedback re-prompting.
3. **Human-In-The-Loop (HITL) Guardrails**:
   - Threshold-based routing (&lt; 0.85 confidence) queues runs for human review.
   - Side-by-side visual diff inspector comparing raw input vs extracted payload with operator manual alterations and pipeline resumption.
4. **Telemetry & Execution Waterfall**:
   - Latency waterfall, token consumption breakdown (prompt vs candidate tokens), failure heatmap matrix (hours vs days), and token spend analytics in USD.
5. **Testing Studio**:
   - 1-Click enterprise presets (Critical AWS Outage, Vendor Invoice $14,250, Ambiguous Refund, SIEM Anomaly) and cURL snippet generator.
