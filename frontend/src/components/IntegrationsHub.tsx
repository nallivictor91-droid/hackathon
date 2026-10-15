import React, { useEffect, useState } from 'react';
import { 
  Share2, 
  MessageSquare, 
  Database, 
  Globe, 
  Mail, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  ExternalLink, 
  Layers 
} from 'lucide-react';
import { api } from '../api/client';
import { ExternalDispatchLog } from '../types';

export const IntegrationsHub: React.FC = () => {
  const [dispatches, setDispatches] = useState<ExternalDispatchLog[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'slack' | 'crm' | 'webhook' | 'email'>('all');
  const [loading, setLoading] = useState(true);

  const loadDispatches = async () => {
    setLoading(true);
    try {
      const data = await api.getDispatches(selectedChannel);
      setDispatches(data);
    } catch (err) {
      console.error('Failed to load dispatches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDispatches();
  }, [selectedChannel]);

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'slack': return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case 'crm': return <Database className="w-4 h-4 text-cyan-400" />;
      case 'webhook': return <Globe className="w-4 h-4 text-purple-400" />;
      case 'email': return <Mail className="w-4 h-4 text-amber-400" />;
      default: return <Share2 className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Simulated Integrations & Audit Dispatch Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time delivery verification across Slack incident channels, CRM customer records, outbound webhooks, and auto-drafted communications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Channel Filters */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {(['all', 'slack', 'crm', 'webhook'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  selectedChannel === ch
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <button
            onClick={loadDispatches}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dispatches List Cards */}
      <div className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Delivered Dispatches Audit Trail ({dispatches.length})
        </div>

        {dispatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispatches.map((disp) => (
              <div
                key={disp.id}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {getChannelIcon(disp.channel)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-white">
                          {disp.channel}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          HTTP {disp.responseCode}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">{disp.destination}</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-cyan-400">
                    {disp.latencyMs}ms
                  </span>
                </div>

                {/* Rendered Message Preview */}
                {disp.renderedMessage && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {disp.renderedMessage}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Exec: {disp.executionId}</span>
                  <span>{new Date(disp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            No dispatches recorded for this channel. Execute a workflow simulation to see dispatches delivered here.
          </div>
        )}
      </div>

    </div>
  );
};
