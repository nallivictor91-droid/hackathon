import React from 'react';
import { 
  Activity, 
  Workflow as WorkflowIcon, 
  ListTree, 
  ShieldAlert, 
  PlayCircle, 
  Share2, 
  Layers, 
  Zap, 
  Radio 
} from 'lucide-react';
import { useStore, NavTab } from '../store/useStore';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, setIsArchitectureModalOpen } = useStore();

  const navItems: { id: NavTab; label: string; icon: any; badge?: string }[] = [
    { id: 'dashboard', label: 'Telemetry & KPIs', icon: Activity },
    { id: 'workflows', label: 'Workflow Builder', icon: WorkflowIcon },
    { id: 'executions', label: 'Execution Traces', icon: ListTree },
    { id: 'hitl', label: 'HITL Review Inbox', icon: ShieldAlert, badge: 'Live Guardrail' },
    { id: 'studio', label: 'Testing Studio', icon: PlayCircle },
    { id: 'integrations', label: 'Integrations Hub', icon: Share2 },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  PulseFlow AI
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Autonomous Workflow Orchestrator
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action: Architecture Visualizer & Live Status */}
          <div className="flex items-center gap-3">
            
            {/* Live Gateway Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Backend :5000</span>
            </div>

            {/* Architecture Modal Trigger */}
            <button
              onClick={() => setIsArchitectureModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-sky-500/10 text-indigo-300 hover:text-white border border-indigo-500/20 hover:border-indigo-500/40 transition-all shadow-sm"
              title="Inspect Frontend vs Backend Architecture"
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Architecture & Separation</span>
            </button>

          </div>

        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex lg:hidden overflow-x-auto py-2.5 space-x-1 border-t border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
};
