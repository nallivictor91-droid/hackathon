import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  RefreshCw, 
  Edit3, 
  Save, 
  HelpCircle, 
  Check, 
  X, 
  UserCheck 
} from 'lucide-react';
import { api } from '../api/client';
import { HitlReviewItem } from '../types';
import { useStore } from '../store/useStore';

export const HitlInbox: React.FC = () => {
  const { setActiveTab } = useStore();
  const [reviews, setReviews] = useState<HitlReviewItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<HitlReviewItem | null>(null);
  const [editablePayload, setEditablePayload] = useState<string>('');
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingHitlReviews();
      setReviews(data);
      if (data.length > 0 && !selectedReview) {
        selectReviewItem(data[0]);
      } else if (data.length === 0) {
        setSelectedReview(null);
      }
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const selectReviewItem = (item: HitlReviewItem) => {
    setSelectedReview(item);
    setEditablePayload(JSON.stringify(item.modifiedPayload || item.extractedPayload, null, 2));
    setOperatorNotes(item.operatorNotes || '');
    setActionSuccess(null);
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedReview) return;
    setSubmitting(true);
    setActionSuccess(null);

    let parsedModified: any = undefined;
    if (action === 'approve') {
      try {
        parsedModified = JSON.parse(editablePayload);
      } catch (err) {
        alert('Invalid JSON in modified payload. Please fix syntax errors before approving.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await api.actionHitlReview(
        selectedReview.id,
        action,
        parsedModified,
        operatorNotes
      );

      setActionSuccess(`Review successfully ${action === 'approve' ? 'approved and pipeline resumed' : 'rejected'}`);
      
      // Refresh list
      const remaining = reviews.filter(r => r.id !== selectedReview.id);
      setReviews(remaining);
      setSelectedReview(remaining[0] || null);
      if (remaining[0]) {
        selectReviewItem(remaining[0]);
      }
    } catch (err: any) {
      alert(`Error executing action: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Human-in-the-Loop (HITL) Guardrail Inbox
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Threshold-based safety queue. High-ambiguity or sub-threshold extractions (&lt; 0.85) require human validation before downstream dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            {reviews.length} Pending Approvals
          </span>
          <button
            onClick={loadPending}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Pending Queue List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Pending Human Verification Queue ({reviews.length})
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {reviews.map((item) => {
                const isSelected = selectedReview?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectReviewItem(item)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20'
                        : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {item.id}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        {(item.confidenceScore * 100).toFixed(0)}% &lt; {(item.threshold * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="text-xs text-white font-semibold mt-2 line-clamp-1">
                      {item.workflowName}
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {item.reasoning}
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Exec: {item.executionId}</span>
                      <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
              <div className="text-sm font-semibold text-slate-300">All Clear! No Pending Reviews</div>
              <p className="text-xs text-slate-500">
                All autonomous executions met or exceeded the confidence threshold.
              </p>
            </div>
          )}
        </div>

        {/* Right: Side-by-Side Visual Diff Inspector & Operator Decision Bar (8 cols) */}
        <div className="lg:col-span-8">
          {selectedReview ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
              
              {/* Review Item Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-mono text-sm font-bold text-white">
                      Review Item: {selectedReview.id}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Score: {(selectedReview.confidenceScore * 100).toFixed(0)}% (Req: {(selectedReview.threshold * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Workflow: <strong className="text-slate-300">{selectedReview.workflowName}</strong> • Execution: <span className="font-mono text-slate-300">{selectedReview.executionId}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Assigned: Tier 2 Operations Lead</span>
                </div>
              </div>

              {/* LLM Reasoning Callout */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Gemini Model Operational Reasoning & Anomaly Flag
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedReview.reasoning}
                </p>
              </div>

              {/* Side-by-Side Visual Diff Inspector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left: Original Raw Inbound Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      Original Raw Inbound Payload
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Read-Only Source</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedReview.originalPayload, null, 2)}</pre>
                  </div>
                </div>

                {/* Right: LLM Extracted Structured Payload (Editable by Human) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                      Structured Output (Editable by Operator)
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">Human Override Ready</span>
                  </div>
                  <textarea
                    value={editablePayload}
                    onChange={(e) => setEditablePayload(e.target.value)}
                    rows={12}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-indigo-500/40 font-mono text-[11px] text-emerald-300 focus:outline-none focus:border-indigo-400 h-64 resize-none"
                  />
                </div>

              </div>

              {/* Operator Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Operator Audit Notes (Logged in permanent compliance trace):
                </label>
                <input
                  type="text"
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  placeholder="e.g. Verified customer SLA contract clause; adjusted severity to 9."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons: Approve & Resume vs Reject */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  onClick={() => handleAction('reject')}
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject & Terminate
                </button>

                <button
                  onClick={() => handleAction('approve')}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Resuming Pipeline...' : 'Approve & Resume Pipeline'}
                </button>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              Select an item from the pending queue to inspect payload diffs and approve or reject.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
