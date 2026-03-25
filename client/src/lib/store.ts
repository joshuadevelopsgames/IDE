import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ─── Types ───────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  expanded?: boolean;
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  language: string;
  content: string;
  originalContent?: string; // for diff view
  isDirty: boolean;
}

export type AgentStatus = "idle" | "thinking" | "running" | "waiting_approval" | "error" | "disconnected";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "active" | "complete" | "failed" | "skipped";
  toolCalls?: ToolCall[];
  startedAt?: number;
  completedAt?: number;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "success" | "failed";
  requiresApproval?: boolean;
  riskLevel?: "low" | "medium" | "high";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCall?: ToolCall;
  planStep?: PlanStep;
}

export interface ApprovalRequest {
  id: string;
  toolCall: ToolCall;
  description: string;
  riskLevel: "low" | "medium" | "high";
  timestamp: number;
  status: "pending" | "approved" | "denied";
  alwaysAllow?: boolean;
}

export interface AgentRun {
  id: string;
  title: string;
  status: AgentStatus;
  plan: PlanStep[];
  messages: ChatMessage[];
  approvals: ApprovalRequest[];
  startedAt: number;
  completedAt?: number;
}

export interface ProjectInfo {
  name: string;
  path: string;
  lastOpened: number;
}

export interface IDESettings {
  hermesPath: string;
  modelProvider: string;
  selectedModelId: string;
  apiKey: string;
  workingDirectory: string;
  maxConcurrentTools: number;
  autoApproveRead: boolean;
  theme: "dark" | "light";
  fontSize: number;
  tabSize: number;
  autocompleteEnabled: boolean;
  autocompleteEndpoint: string;
}

export type ActiveView = "home" | "workspace";
export type RightPanel = "chat" | "approvals" | "settings" | "devmode" | "none";

// ─── Store ───────────────────────────────────────────────────────────

interface IDEState {
  // Navigation
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Right panel
  rightPanel: RightPanel;
  setRightPanel: (panel: RightPanel) => void;
  rightPanelWidth: number;
  setRightPanelWidth: (w: number) => void;

  // File tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  toggleFolder: (path: string) => void;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;

  // Editor tabs
  tabs: EditorTab[];
  activeTabId: string | null;
  openFile: (tab: EditorTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  setTabDiff: (id: string, original: string) => void;

  // Agent
  agentStatus: AgentStatus;
  setAgentStatus: (status: AgentStatus) => void;
  currentRun: AgentRun | null;
  runs: AgentRun[];
  startRun: (title: string) => void;
  addMessage: (msg: ChatMessage) => void;
  updatePlanStep: (stepId: string, update: Partial<PlanStep>) => void;
  addPlanStep: (step: PlanStep) => void;
  addApproval: (approval: ApprovalRequest) => void;
  resolveApproval: (id: string, approved: boolean, alwaysAllow?: boolean) => void;

  // Projects
  recentProjects: ProjectInfo[];
  currentProject: ProjectInfo | null;
  openProject: (project: ProjectInfo) => void;
  addRecentProject: (project: ProjectInfo) => void;

  // Settings
  settings: IDESettings;
  updateSettings: (partial: Partial<IDESettings>) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Terminal
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Dev Mode
  devModeActive: boolean;
  setDevModeActive: (active: boolean) => void;
  toggleDevMode: () => void;
}

export const useIDEStore = create<IDEState>()(
  immer((set) => ({
    // Navigation
    activeView: "home",
    setActiveView: (view) => set((s) => { s.activeView = view; }),

    // Right panel
    rightPanel: "chat",
    setRightPanel: (panel) => set((s) => { s.rightPanel = panel; }),
    rightPanelWidth: 380,
    setRightPanelWidth: (w) => set((s) => { s.rightPanelWidth = w; }),

    // File tree
    fileTree: [],
    setFileTree: (tree) => set((s) => { s.fileTree = tree; }),
    toggleFolder: (path) =>
      set((s) => {
        const toggle = (nodes: FileNode[]): boolean => {
          for (const node of nodes) {
            if (node.path === path && node.type === "directory") {
              node.expanded = !node.expanded;
              return true;
            }
            if (node.children && toggle(node.children)) return true;
          }
          return false;
        };
        toggle(s.fileTree);
      }),
    selectedFile: null,
    setSelectedFile: (path) => set((s) => { s.selectedFile = path; }),

    // Editor tabs
    tabs: [],
    activeTabId: null,
    openFile: (tab) =>
      set((s) => {
        const existing = s.tabs.find((t) => t.path === tab.path);
        if (existing) {
          s.activeTabId = existing.id;
        } else {
          s.tabs.push(tab);
          s.activeTabId = tab.id;
        }
      }),
    closeTab: (id) =>
      set((s) => {
        const idx = s.tabs.findIndex((t) => t.id === id);
        if (idx !== -1) {
          s.tabs.splice(idx, 1);
          if (s.activeTabId === id) {
            s.activeTabId = s.tabs.length > 0 ? s.tabs[Math.max(0, idx - 1)].id : null;
          }
        }
      }),
    setActiveTab: (id) => set((s) => { s.activeTabId = id; }),
    updateTabContent: (id, content) =>
      set((s) => {
        const tab = s.tabs.find((t) => t.id === id);
        if (tab) {
          tab.content = content;
          tab.isDirty = true;
        }
      }),
    setTabDiff: (id, original) =>
      set((s) => {
        const tab = s.tabs.find((t) => t.id === id);
        if (tab) tab.originalContent = original;
      }),

    // Agent
    agentStatus: "idle",
    setAgentStatus: (status) => set((s) => { s.agentStatus = status; }),
    currentRun: null,
    runs: [],
    startRun: (title) =>
      set((s) => {
        const run: AgentRun = {
          id: crypto.randomUUID(),
          title,
          status: "thinking",
          plan: [],
          messages: [],
          approvals: [],
          startedAt: Date.now(),
        };
        s.currentRun = run;
        s.agentStatus = "thinking";
        s.rightPanel = "chat";
      }),
    addMessage: (msg) =>
      set((s) => {
        if (s.currentRun) s.currentRun.messages.push(msg);
      }),
    updatePlanStep: (stepId, update) =>
      set((s) => {
        if (!s.currentRun) return;
        const step = s.currentRun.plan.find((p) => p.id === stepId);
        if (step) Object.assign(step, update);
      }),
    addPlanStep: (step) =>
      set((s) => {
        if (s.currentRun) s.currentRun.plan.push(step);
      }),
    addApproval: (approval) =>
      set((s) => {
        if (s.currentRun) {
          s.currentRun.approvals.push(approval);
          s.agentStatus = "waiting_approval";
        }
      }),
    resolveApproval: (id, approved, alwaysAllow) =>
      set((s) => {
        if (!s.currentRun) return;
        const a = s.currentRun.approvals.find((x) => x.id === id);
        if (a) {
          a.status = approved ? "approved" : "denied";
          a.alwaysAllow = alwaysAllow;
        }
        const hasPending = s.currentRun.approvals.some((x) => x.status === "pending");
        if (!hasPending) s.agentStatus = "running";
      }),

    // Projects
    recentProjects: [
      { name: "my-web-app", path: "/Users/dev/projects/my-web-app", lastOpened: Date.now() - 86400000 },
      { name: "api-server", path: "/Users/dev/projects/api-server", lastOpened: Date.now() - 172800000 },
      { name: "ml-pipeline", path: "/Users/dev/projects/ml-pipeline", lastOpened: Date.now() - 259200000 },
    ],
    currentProject: null,
    openProject: (project) =>
      set((s) => {
        s.currentProject = project;
        s.activeView = "workspace";
      }),
    addRecentProject: (project) =>
      set((s) => {
        const idx = s.recentProjects.findIndex((p) => p.path === project.path);
        if (idx !== -1) s.recentProjects.splice(idx, 1);
        s.recentProjects.unshift(project);
        if (s.recentProjects.length > 10) s.recentProjects.pop();
      }),

    // Settings
    settings: {
      hermesPath: "",
      modelProvider: "nous",
      selectedModelId: "nous/hermes-3-llama-3.1-70b",
      apiKey: "",
      workingDirectory: "",
      maxConcurrentTools: 3,
      autoApproveRead: true,
      theme: "dark",
      fontSize: 13,
      tabSize: 2,
      autocompleteEnabled: true,
      autocompleteEndpoint: "http://localhost:8080/v1/completions",
    },
    updateSettings: (partial) =>
      set((s) => {
        Object.assign(s.settings, partial);
      }),

    // Command palette
    commandPaletteOpen: false,
    setCommandPaletteOpen: (open) => set((s) => { s.commandPaletteOpen = open; }),

    // Terminal
    terminalOpen: false,
    setTerminalOpen: (open) => set((s) => { s.terminalOpen = open; }),

    // Search
    searchOpen: false,
    setSearchOpen: (open) => set((s) => { s.searchOpen = open; }),

    // Dev Mode
    devModeActive: false,
    setDevModeActive: (active) => set((s) => { s.devModeActive = active; }),
    toggleDevMode: () => set((s) => {
      s.devModeActive = !s.devModeActive;
      if (s.devModeActive) s.rightPanel = "devmode";
      else if (s.rightPanel === "devmode") s.rightPanel = "chat";
    }),
  }))
);
