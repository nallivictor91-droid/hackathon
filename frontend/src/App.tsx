import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { WorkflowBuilder } from './components/WorkflowBuilder';
import { ExecutionTraces } from './components/ExecutionTraces';
import { HitlInbox } from './components/HitlInbox';
import { TestingStudio } from './components/TestingStudio';
import { IntegrationsHub } from './components/IntegrationsHub';
import { ArchitectureModal } from './components/ArchitectureModal';
import { useStore } from './store/useStore';
import { Shield, Server, Layers } from 'lucide-react';

const queryClient = new QueryClient();

export function App() {
  const { activeTab, setIsArchitectureModalOpen } = useStore();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'workflows':
        return <WorkflowBuilder />;
      case 'executions':
        return <ExecutionTraces />;
      case 'hitl':
        return <HitlInbox />;
      case 'studio':
        return <TestingStudio />;
      case 'integrations':
        return <IntegrationsHub />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        
        {/* Navigation Bar */}
        <Navbar />

        {/* Global Architecture Inspector Modal */}
        <ArchitectureModal />

        {/* Main Application Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderActiveView()}
        </main>

        {/* Enterprise Decoupled Architecture Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-300">PulseFlow AI</span>
              <span>•</span>
              <span className="text-slate-400">Decoupled Multi-Tier Platform</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-sky-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                Frontend :5173
              </span>
              <span>↔</span>
              <span className="text-indigo-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                Express Gateway :5000
              </span>
              <span>↔</span>
              <span className="text-purple-400">@google/genai</span>
              <span>↔</span>
              <span className="text-emerald-400">Supabase DB</span>
            </div>

            <button
              onClick={() => setIsArchitectureModalOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              View Architecture & Security Boundaries
            </button>
          </div>
        </footer>

      </div>
    </QueryClientProvider>
  );
}

export default App;
