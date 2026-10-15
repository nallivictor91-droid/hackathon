import React, { useEffect, useState } from 'react';
import { 
  Workflow as WorkflowIcon, 
  Play, 
  Copy, 
  Trash2, 
  Plus, 
  Sliders, 
  Cpu, 
  ShieldAlert, 
  Share2, 
  Check, 
  ArrowRight, 
  FileText, 
  Webhook, 
  Calendar, 
  Layers, 
  Code2, 
  Zap,
  HelpCircle,
  X 
} from 'lucide-react';
import { api } from '../api/client';
import { Workflow, WorkflowNode } from '../types';
import { useStore } from '../store/useStore';

export const WorkflowBuilder: React.FC = () => {
  const { setActiveTab, setSelectedExecution } = useStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWf, setSelectedWf] = useState<Workflow | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // New Workflow Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [newWfDesc, setNewWfDesc] = useState('');
  const [newWfTrigger, setNewWfTrigger] = useState<'webhook' | 'document' | 'manual' | 'scheduled'>('webhook');

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const data = await api.getWorkflows();
      setWorkflows(data);
      if (data.length > 0 && !selectedWf) {
        setSelectedWf(data[0]);
        setSelectedNode(data[0].nodes[0] || null);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleSelectWorkflow = (wf: Workflow) => {
    setSelectedWf(wf);
    setSelectedNode(wf.nodes[0] || null);
    setSimResult(null);
  };

  const handleSimulate = async () => {
    if (!selectedWf) return;
    setSimulating(true);
    setSimResult(null);
    try {
      let testPayload: any = {
        ticketBody: 'CRITICAL: Our database replicas are experiencing high replication lag and transactions are failing with timeout errors.',
        customerEmail: 'infra-lead@megacorp.global',
      };

      if (selectedWf.trigger.type === 'document') {
        testPayload = {
          fileName: 'Sample_Invoice_INV-84920.pdf',
          invoiceText: 'Vendor: Enterprise Cloud Systems Inc. Total Amount: $12,450.00. Tax: $996.00. PO: PO-99218. Due Date: Net 30 days.',
        };
      }

      const res = await api.executeWorkflow(selectedWf.id, testPayload);
      setSimResult(res);
    } catch (err: any) {
      setSimResult({ error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const handleToggleStatus = async (wf: Workflow) => {
    const nextStatus = wf.status === 'active' ? 'paused' : 'active';
    try {
      const updated = await api.updateWorkflow(wf.id, { status: nextStatus });
      setWorkflows(workflows.map(w => w.id === wf.id ? updated : w));
      if (selectedWf?.id === wf.id) setSelectedWf(updated);
    } catch (err) {
      console.error('Failed to update workflow status:', err);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWfName) return;
    try {
      const created = await api.createWorkflow({
        name: newWfName,
        description: newWfDesc || 'Custom Autonomous Workflow pipeline',
        status: 'active',
        confidenceThreshold: 0.85,
        trigger: {
          type: newWfTrigger,
          name: `${newWfName} Trigger`,
          description: `Auto-generated ${newWfTrigger} trigger`,
          config: { webhookToken: `wh_${Date.now()}` },
        },
        nodes: [
          {
            id: 'node-classifier-1',
            name: 'Domain Classifier',
            type: 'semantic_classifier',
            config: {
              model: 'gemini-2.5-flash',
              confidenceThreshold: 0.85,
              detectSentiment: true,
              categories: [
                { id: 'tier1_support', name: 'Tier 1 Support', description: 'General customer inquiries' },
                { id: 'escalation', name: 'Critical Escalation', description: 'Immediate operational issues' },
              ],
            },
          },
          {
            id: 'node-extractor-1',
            name: 'Structured Payload Extractor',
            type: 'context_extraction',
            config: {
              model: 'gemini-2.5-flash',
              promptTemplate: 'Extract key operational attributes: {{input}}',
              targetSchema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  urgencyScore: { type: 'number' },
                },
                required: ['summary'],
              },
            },
          },
          {
            id: 'node-hitl-1',
            name: 'HITL Review Guardrail',
            type: 'hitl_review',
            config: {
              confidenceThreshold: 0.85,
              bypassIfConfidenceMet: true,
              assignedRole: 'Operations Analyst',
            },
          },
          {
            id: 'node-dispatcher-1',
            name: 'Slack Notification Dispatcher',
            type: 'external_dispatcher',
            config: {
              channel: 'slack',
              destination: '#general-alerts',
              template: 'Pipeline completed: {{extracted.summary}} (Urgency: {{extracted.urgencyScore}})',
              includeRawPayload: false,
              includeStepTraces: true,
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger', target: 'node-classifier-1' },
          { id: 'e2', source: 'node-classifier-1', target: 'node-extractor-1' },
          { id: 'e3', source: 'node-extractor-1', target: 'node-hitl-1' },
          { id: 'e4', source: 'node-hitl-1', target: 'node-dispatcher-1' },
        ],
      });

      setWorkflows([created, ...workflows]);
      setSelectedWf(created);
      setSelectedNode(created.nodes[0]);
      setIsCreateModalOpen(false);
      setNewWfName('');
      setNewWfDesc('');
    } catch (err: any) {
      alert(`Failed to create workflow: ${err.message}`);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'semantic_classifier': return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'context_extraction': return <FileText className="w-4 h-4 text-sky-400" />;
      case 'conditional_router': return <Sliders className="w-4 h-4 text-amber-400" />;
      case 'hitl_review': return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'external_dispatcher': return <Share2 className="w-4 h-4 text-emerald-400" />;
      default: return <WorkflowIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Visual Rule & Workflow Builder
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure multi-step trigger-action-decision sequences with Gemini Structured Outputs and HITL guardrails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Main Builder Grid: Workflow Selector + Interactive Canvas + Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Workflows List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Configured Pipelines ({workflows.length})
          </div>

          <div className="space-y-2.5">
            {workflows.map((wf) => {
              const isSelected = selectedWf?.id === wf.id;
              return (
                <div
                  key={wf.id}
                  onClick={() => handleSelectWorkflow(wf)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm">{wf.name}</h4>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {wf.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                      {wf.trigger.type === 'webhook' && <Webhook className="w-3 h-3 text-cyan-400" />}
                      {wf.trigger.type === 'document' && <FileText className="w-3 h-3 text-emerald-400" />}
                      {wf.trigger.type === 'scheduled' && <Calendar className="w-3 h-3 text-purple-400" />}
                      {wf.trigger.type}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">
                        Guardrail: {((wf.confidenceThreshold || 0.85) * 100).toFixed(0)}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(wf);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          wf.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {wf.status}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Visual Canvas & Node Inspector (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {selectedWf ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
              
              {/* Canvas Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedWf.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Trigger: <span className="text-slate-300 font-mono">{selectedWf.trigger.name}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 transition-all"
                  >
                    <Play className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                    {simulating ? 'Orchestrating...' : 'Run Simulation'}
                  </button>
                </div>
              </div>

              {/* Simulation Result Banner if run */}
              {simResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Pipeline Simulation Executed Successfully
                    </span>
                    <button
                      onClick={() => {
                        setSelectedExecution(simResult);
                        setActiveTab('executions');
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Inspect Deep Trace →
                    </button>
                  </div>
                  <div className="text-xs font-mono text-slate-400 flex items-center gap-4">
                    <span>ID: {simResult.id}</span>
                    <span>Status: <strong className="text-emerald-400">{simResult.status}</strong></span>
                    <span>Latency: {simResult.latencyMs}ms</span>
                    <span>Tokens: {simResult.totalTokens}</span>
                  </div>
                </div>
              )}

              {/* Visual Pipeline Sequence Nodes */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Sequential Node Pipeline Flow
                </div>

                {/* Trigger Capsule */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <Webhook className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white uppercase tracking-wider">
                        Trigger Ingest: {selectedWf.trigger.type}
                      </div>
                      <div className="text-xs text-slate-400">{selectedWf.trigger.name}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Input Source
                  </span>
                </div>

                {/* Connecting arrow */}
                <div className="flex justify-center text-slate-600">
                  <div className="w-0.5 h-4 bg-slate-800"></div>
                </div>

                {/* Nodes Sequence */}
                <div className="space-y-3">
                  {selectedWf.nodes.map((node, idx) => {
                    const isNodeSelected = selectedNode?.id === node.id;
                    return (
                      <React.Fragment key={node.id}>
                        <div
                          onClick={() => setSelectedNode(node)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isNodeSelected
                              ? 'bg-indigo-950/20 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                              {getNodeIcon(node.type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{node.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Step {idx + 1}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{node.description || node.type}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {node.config.model && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                {node.config.model}
                              </span>
                            )}
                            {node.type === 'hitl_review' && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                &lt; {((node.config.confidenceThreshold || 0.85) * 100).toFixed(0)}%
                              </span>
                            )}
                            <span className="text-xs text-indigo-400 font-medium hover:underline">
                              Configure →
                            </span>
                          </div>
                        </div>

                        {idx < selectedWf.nodes.length - 1 && (
                          <div className="flex justify-center text-slate-600">
                            <div className="w-0.5 h-4 bg-slate-800"></div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Node Inspector Drawer */}
              {selectedNode && (
                <div className="p-5 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(selectedNode.type)}
                      <h4 className="font-semibold text-white text-sm">
                        Node Inspector: {selectedNode.name}
                      </h4>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Type: {selectedNode.type}
                    </span>
                  </div>

                  {/* Dynamic Inspector Fields based on NodeType */}
                  {selectedNode.type === 'context_extraction' && (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-slate-400 font-medium">Foundation Model:</label>
                        <div className="mt-1 font-mono text-purple-300">
                          {selectedNode.config.model || 'gemini-2.5-pro'}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 font-medium">Prompt Extraction Template:</label>
                        <div className="mt-1 p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300 text-[11px]">
                          {selectedNode.config.promptTemplate}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 font-medium">Target JSON Schema Enforcement:</label>
                        <pre className="mt-1 p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-emerald-300 text-[11px] overflow-x-auto">
                          {JSON.stringify(selectedNode.config.targetSchema, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'semantic_classifier' && (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-slate-400 font-medium">Classification Categories:</label>
                        <div className="mt-2 space-y-1.5">
                          {selectedNode.config.categories?.map((cat: any) => (
                            <div key={cat.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                              <span className="font-semibold text-white">{cat.name} ({cat.id})</span>
                              <span className="text-slate-400">{cat.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-slate-400">Confidence Threshold:</span>
                          <span className="ml-2 font-mono text-amber-400">
                            {selectedNode.config.confidenceThreshold || 0.85}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Detect Sentiment:</span>
                          <span className="ml-2 font-mono text-emerald-400">
                            {selectedNode.config.detectSentiment ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'conditional_router' && (
                    <div className="space-y-3 text-xs">
                      <label className="text-slate-400 font-medium">Configured Decision Branches:</label>
                      <div className="space-y-2">
                        {selectedNode.config.branches?.map((branch: any) => (
                          <div key={branch.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                            <div className="flex justify-between font-semibold text-white">
                              <span>Branch: {branch.name}</span>
                              <span className="text-indigo-400 font-mono text-[11px]">→ Target: {branch.targetNodeId}</span>
                            </div>
                            {branch.conditions && branch.conditions.length > 0 ? (
                              <div className="text-slate-400 font-mono text-[11px]">
                                Condition: {branch.conditions.map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(' AND ')}
                              </div>
                            ) : (
                              <div className="text-slate-500 font-mono text-[11px]">Default fallback branch</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'hitl_review' && (
                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300">
                        <strong>Human-in-the-Loop Guardrail:</strong> When model extraction confidence drops below the threshold, downstream executions are paused, and a visual diff review is queued.
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <span className="text-slate-400">Threshold:</span>
                          <div className="font-bold text-amber-400 text-sm mt-0.5">
                            {((selectedNode.config.confidenceThreshold || 0.85) * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <span className="text-slate-400">Reviewer Role:</span>
                          <div className="font-bold text-white text-sm mt-0.5">
                            {selectedNode.config.assignedRole || 'Operations Lead'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'external_dispatcher' && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <span className="text-slate-400">Channel:</span>
                          <div className="font-bold text-emerald-400 uppercase text-sm mt-0.5">
                            {selectedNode.config.channel}
                          </div>
                        </div>
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <span className="text-slate-400">Destination Target:</span>
                          <div className="font-mono text-white text-xs mt-0.5 truncate">
                            {selectedNode.config.destination}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 font-medium">Message Template:</label>
                        <div className="mt-1 p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-slate-300 text-[11px]">
                          {selectedNode.config.template}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              Select or create a workflow to view its interactive pipeline sequence.
            </div>
          )}

        </div>

      </div>

      {/* New Workflow Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Create New Workflow Pipeline</h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Workflow Name:</label>
                <input
                  type="text"
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="e.g. VIP Customer Contract Ingest"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Description:</label>
                <textarea
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                  placeholder="Operational purpose and routing rules..."
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Trigger Type:</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['webhook', 'document', 'manual', 'scheduled'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewWfTrigger(t)}
                      className={`py-2 px-3 rounded-lg border text-xs capitalize ${
                        newWfTrigger === t
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={!newWfName}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
              >
                Create Pipeline
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
