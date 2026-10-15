import { create } from 'zustand';
import { Workflow, ExecutionRun, HitlReviewItem } from '../types';

export type NavTab = 
  | 'dashboard' 
  | 'workflows' 
  | 'executions' 
  | 'hitl' 
  | 'studio' 
  | 'integrations' 
  | 'architecture';

interface AppState {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  selectedWorkflow: Workflow | null;
  setSelectedWorkflow: (wf: Workflow | null) => void;

  selectedExecution: ExecutionRun | null;
  setSelectedExecution: (exec: ExecutionRun | null) => void;

  selectedHitlItem: HitlReviewItem | null;
  setSelectedHitlItem: (item: HitlReviewItem | null) => void;

  isArchitectureModalOpen: boolean;
  setIsArchitectureModalOpen: (open: boolean) => void;

  isNewWorkflowModalOpen: boolean;
  setIsNewWorkflowModalOpen: (open: boolean) => void;

  liveEvents: any[];
  addLiveEvent: (event: any) => void;

  refreshVersion: number;
  triggerRefresh: () => void;
}

export const useStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (activeTab) => set({ activeTab }),

  selectedWorkflow: null,
  setSelectedWorkflow: (selectedWorkflow) => set({ selectedWorkflow }),

  selectedExecution: null,
  setSelectedExecution: (selectedExecution) => set({ selectedExecution }),

  selectedHitlItem: null,
  setSelectedHitlItem: (selectedHitlItem) => set({ selectedHitlItem }),

  isArchitectureModalOpen: false,
  setIsArchitectureModalOpen: (isArchitectureModalOpen) => set({ isArchitectureModalOpen }),

  isNewWorkflowModalOpen: false,
  setIsNewWorkflowModalOpen: (isNewWorkflowModalOpen) => set({ isNewWorkflowModalOpen }),

  liveEvents: [],
  addLiveEvent: (event) => set((state) => ({ liveEvents: [event, ...state.liveEvents].slice(0, 30) })),

  refreshVersion: 0,
  triggerRefresh: () => set((state) => ({ refreshVersion: state.refreshVersion + 1 })),
}));
