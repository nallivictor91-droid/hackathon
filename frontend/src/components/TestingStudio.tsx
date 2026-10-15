import React, { useState } from 'react';
import { 
  PlayCircle, 
  Send, 
  UploadCloud, 
  FileCode, 
  Terminal, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Copy, 
  Check, 
  Sparkles, 
  ArrowRight 
} from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store/useStore';

export const TestingStudio: React.FC = () => {
  const { setActiveTab, setSelectedExecution } = useStore();
  const [activePreset, setActivePreset] = useState<string>('preset-outage');
  const [webhookToken, setWebhookToken] = useState('wh_support_live_94827');
  const [customPayload, setCustomPayload] = useState<string>(
    JSON.stringify(
      {
        ticketBody: 'CRITICAL: Our primary payment gateway is throwing HTTP 504 Gateway Timeout errors across all European production clusters. Customers cannot complete checkout. This violates our 99.99% enterprise SLA.',
        customerEmail: 'cto@fintechglobal.corp',
      },
      null,
      2
    )
  );

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractingDoc, setExtractingDoc] = useState(false);
  const [docResult, setDocResult] = useState<any>(null);

  const presets = [
    {
      id: 'preset-outage',
      title: '🚨 Critical AWS 504 Outage Ticket',
      subtitle: 'Triggers Enterprise SLA Router -> High Urgency -> Slack Escalation',
      token: 'wh_support_live_94827',
      payload: {
        ticketBody: 'CRITICAL: Our primary payment gateway is throwing HTTP 504 Gateway Timeout errors across all European production clusters. Customers cannot complete checkout. This violates our 99.99% enterprise SLA.',
        customerEmail: 'cto@fintechglobal.corp',
      },
    },
    {
      id: 'preset-invoice',
      title: '📄 Vendor Invoice Disbursement ($14,250)',
      subtitle: 'Triggers AP Processor -> Amount > $5,000 limit -> Routes to Finance HITL Review',
      token: 'wh_support_live_94827',
      payload: {
        fileName: 'Invoice_Datadog_Q3_99482.pdf',
        vendorName: 'Datadog Enterprise Cloud Services Inc.',
        invoiceNumber: 'INV-2026-8841',
        totalAmount: 14250.00,
        currency: 'USD',
        poNumber: 'PO-ENTERPRISE-9910',
        lineItems: [
          { description: 'Cloud SIEM Telemetry Ingestion (10TB)', amount: 12000.00 },
          { description: 'Enterprise 24/7 SLA Support Tier', amount: 2250.00 },
        ],
      },
    },
    {
      id: 'preset-hitl-ambiguous',
      title: '⚠️ Ambiguous Refund Dispute (< 85% Confidence)',
      subtitle: 'Triggers Support Triage -> Low Confidence Score -> Paused for HITL Review Inbox',
      token: 'wh_support_live_94827',
      payload: {
        ticketBody: 'Maybe we need a refund or maybe we just want to downgrade our cloud seats? We spoke to someone last week but nothing was updated on our credit card statement. Please help resolve this.',
        customerEmail: 'finance-lead@ambiguouscorp.io',
      },
    },
    {
      id: 'preset-security',
      title: '🛡️ SIEM Brute Force Anomaly',
      subtitle: 'Triggers Security Sentinel -> Threat Level High -> Firewall Block Relay',
      token: 'wh_support_live_94827',
      payload: {
        sourceIp: '185.220.101.5',
        failedLoginCount: 420,
        targetEndpoint: '/api/v1/auth/admin/token',
        userAgent: 'Masscan/1.0.5 (Recon Bot)',
        geoCountry: 'RO',
      },
    },
  ];

  const handleSelectPreset = (p: typeof presets[0]) => {
    setActivePreset(p.id);
    setWebhookToken(p.token);
    setCustomPayload(JSON.stringify(p.payload, null, 2));
    setResult(null);
  };

  const handleDispatch = async () => {
    setRunning(true);
    setResult(null);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(customPayload);
      } catch (err) {
        alert('Payload is not valid JSON. Please check syntax.');
        setRunning(false);
        return;
      }

      // Execute via workflow ID or direct webhook
      const workflows = await api.getWorkflows();
      const targetWf = workflows[0] || null;

      if (!targetWf) {
        throw new Error('No active workflow found to test against');
      }

      const res = await api.executeWorkflow(targetWf.id, parsed);
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const copyCurlSnippet = () => {
    const curl = `curl -X POST http://localhost:5000/api/webhooks/${webhookToken} \\
  -H "Content-Type: application/json" \\
  -d '${customPayload.replace(/\n/g, ' ')}'`;
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleDocumentExtract = async () => {
    if (!selectedFile) return;
    setExtractingDoc(true);
    setDocResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('prompt', 'Analyze this document with high precision, extracting all financial amounts, vendor name, invoice date, and key terms.');
      formData.append('model', 'gemini-2.5-pro');

      const data = await api.extractDocument(formData);
      setDocResult(data);
    } catch (err: any) {
      setDocResult({ error: err.message });
    } finally {
      setExtractingDoc(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Simulation & Ingestion Testing Studio
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Trigger live workflow pipelines with simulated enterprise webhooks, multimodal documents, and pre-built SLA scenarios.
        </p>
      </div>

      {/* Preset Scenario Cards */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          1-Click Enterprise Test Scenarios
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {presets.map((p) => {
            const isSelected = activePreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                  isSelected
                    ? 'bg-indigo-950/20 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/90'
                }`}
              >
                <div className="font-semibold text-xs text-white line-clamp-1">{p.title}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{p.subtitle}</div>
                <div className="pt-2 text-[10px] font-mono text-indigo-400 flex items-center gap-1">
                  Load Scenario →
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid: Webhook / Payload Tester (Left) & Multimodal Document Tester (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Webhook & JSON Payload Simulator (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Inbound Webhook Payload Simulator
            </h3>
            <button
              onClick={copyCurlSnippet}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCurl ? 'cURL Copied' : 'Copy cURL'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Target Webhook Endpoint Token:</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                  POST /api/webhooks/
                </span>
                <input
                  type="text"
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-400 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">JSON Ingest Body:</label>
                <span className="text-[10px] text-slate-500 font-mono">application/json</span>
              </div>
              <textarea
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                rows={10}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Executes complete multi-node pipeline with Gemini structured validation.
              </span>
              <button
                onClick={handleDispatch}
                disabled={running}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
                {running ? 'Executing Pipeline...' : 'Dispatch Ingest Payload'}
              </button>
            </div>
          </div>

          {/* Execution Result Display */}
          {result && (
            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Execution Completed: <strong className="font-mono text-indigo-300">{result.id}</strong>
                </span>
                <button
                  onClick={() => {
                    setSelectedExecution(result);
                    setActiveTab('executions');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  View Step Waterfall Trace →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500">Status: </span>
                  <strong className={result.status === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                    {result.status}
                  </strong>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500">Latency: </span>
                  <strong className="text-cyan-400">{result.latencyMs}ms</strong>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500">Tokens: </span>
                  <strong className="text-purple-400">{result.totalTokens}</strong>
                </div>
              </div>

              {result.outputPayload && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Accumulated Pipeline Context:</div>
                  <pre className="p-3 rounded-lg bg-slate-900 font-mono text-[11px] text-emerald-300 max-h-40 overflow-y-auto">
                    {JSON.stringify(result.outputPayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Multimodal Document Extraction Studio (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              Multimodal Document Extractor
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Powered by <strong>Gemini 2.5 Pro</strong> for complex OCR & financial document parsing.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* File Upload Box */}
            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 text-center space-y-3 bg-slate-950/60 transition-colors">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <label className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-semibold">
                  <span>Upload a PDF, PNG, or TIFF document</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <p className="text-slate-500 text-[11px] mt-1">Invoices, contracts, receipts up to 20MB</p>
              </div>

              {selectedFile && (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 text-left flex items-center justify-between">
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="text-slate-500 ml-2">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                </div>
              )}
            </div>

            <button
              onClick={handleDocumentExtract}
              disabled={!selectedFile || extractingDoc}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {extractingDoc ? 'Parsing with Gemini 2.5 Pro...' : 'Extract Structured Document Fields'}
            </button>

            {/* Document Result */}
            {docResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-emerald-400">Structured Extraction Success</span>
                  <span className="font-mono text-cyan-400">{docResult.metrics?.latencyMs}ms</span>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 font-mono text-[11px] text-emerald-300 max-h-52 overflow-y-auto">
                  {JSON.stringify(docResult.extractedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
