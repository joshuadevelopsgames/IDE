/*
 * Obsidian Forge — Main Workspace
 * Three-column asymmetric layout: file tree | editor+terminal | right panel (agent/chat/approvals/settings).
 * Thin command strip top bar, status bar at bottom.
 */
import { lazy, Suspense } from "react";
import {
  PanelGroup, Panel, PanelResizeHandle
} from "react-resizable-panels";
import {
  FolderTree, Play, MessageSquare, ShieldAlert, Settings,
  Terminal as TerminalIcon, Search, Command, ChevronLeft, X, Minus, Square,
  Maximize2, Circle, GitBranch, Wifi, WifiOff, Loader2,
  PanelRightClose, PanelRightOpen
} from "lucide-react";
import FileTree from "@/components/FileTree";
import CodeEditor from "@/components/CodeEditor";
import AgentPanel from "@/components/AgentPanel";
import ChatThread from "@/components/ChatThread";
import ApprovalsQueue from "@/components/ApprovalsQueue";
import SettingsPanel from "@/components/SettingsPanel";
import CommandPalette from "@/components/CommandPalette";
import { useIDEStore, type RightPanel, type AgentStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

// Lazy-load terminal to avoid loading xterm.js until needed
const TerminalPanel = lazy(() => import("@/components/Terminal"));

function TitleBar() {
  const { setActiveView, currentProject, setCommandPaletteOpen } = useIDEStore();

  return (
    <div className="flex items-center h-[36px] bg-forge-gutter border-b border-border select-none shrink-0">
      {/* Left: back + project name */}
      <div className="flex items-center gap-1 px-2 min-w-[220px]">
        <button
          onClick={() => setActiveView("home")}
          className="p-1 rounded hover:bg-forge-surface-raised text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663334932816/NySiUCnVhDhjqciPuE4bRd/agent-avatar-SXWBPzjYmAUnkgKGXLrf7U.webp"
          alt=""
          className="w-4 h-4 rounded"
        />
        <span className="text-[12px] font-semibold text-foreground/80 truncate ml-1">
          {currentProject?.name || "Dream IDE"}
        </span>
      </div>

      {/* Center: command bar trigger */}
      <div className="flex-1 flex justify-center">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-4 py-1 rounded bg-forge-surface-raised/50 border border-border/50 hover:border-forge-amber/30 transition-colors group max-w-[400px] w-full"
        >
          <Search className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-[11px] text-muted-foreground/30 flex-1 text-left">Search files, commands...</span>
          <kbd className="text-[9px] text-muted-foreground/25 bg-forge-gutter px-1 py-0.5 rounded font-mono-code">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: window controls (decorative in web) */}
      <div className="flex items-center gap-1 px-3">
        <div className="w-3 h-3 rounded-full bg-forge-surface-overlay" />
        <div className="w-3 h-3 rounded-full bg-forge-surface-overlay" />
        <div className="w-3 h-3 rounded-full bg-forge-surface-overlay" />
      </div>
    </div>
  );
}

function ActivityBar() {
  const { rightPanel, setRightPanel, currentRun, terminalOpen, setTerminalOpen } = useIDEStore();
  const pendingApprovals = currentRun?.approvals.filter((a) => a.status === "pending").length || 0;

  const items: { id: RightPanel; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "agent", icon: <Play className="w-4 h-4" />, label: "Agent" },
    { id: "chat", icon: <MessageSquare className="w-4 h-4" />, label: "Chat" },
    {
      id: "approvals",
      icon: <ShieldAlert className="w-4 h-4" />,
      label: "Approvals",
      badge: pendingApprovals,
    },
    { id: "settings", icon: <Settings className="w-4 h-4" />, label: "Settings" },
  ];

  return (
    <div className="flex flex-col items-center w-[42px] bg-forge-gutter border-r border-border py-2 gap-1 shrink-0">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setRightPanel(rightPanel === item.id ? "none" : item.id)}
          className={cn(
            "relative w-8 h-8 rounded flex items-center justify-center transition-colors",
            rightPanel === item.id
              ? "bg-forge-surface-raised text-forge-amber"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-forge-surface-raised/50"
          )}
          title={item.label}
        >
          {item.icon}
          {rightPanel === item.id && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-forge-amber rounded-r" />
          )}
          {item.badge && item.badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-forge-amber text-[8px] font-bold text-forge-gutter flex items-center justify-center">
              {item.badge}
            </span>
          )}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Terminal toggle */}
      <button
        onClick={() => setTerminalOpen(!terminalOpen)}
        className={cn(
          "w-8 h-8 rounded flex items-center justify-center transition-colors",
          terminalOpen
            ? "bg-forge-surface-raised text-forge-amber"
            : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-forge-surface-raised/50"
        )}
        title="Terminal (Ctrl+`)"
      >
        <TerminalIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function StatusBar() {
  const { agentStatus, currentRun, currentProject, settings } = useIDEStore();

  const statusConfig: Record<AgentStatus, { color: string; label: string }> = {
    idle: { color: "text-muted-foreground/40", label: "Idle" },
    thinking: { color: "text-forge-amber", label: "Thinking..." },
    running: { color: "text-forge-amber", label: "Running" },
    waiting_approval: { color: "text-yellow-400", label: "Waiting for approval" },
    error: { color: "text-forge-coral", label: "Error" },
    disconnected: { color: "text-muted-foreground/30", label: "Disconnected" },
  };

  const sc = statusConfig[agentStatus];

  return (
    <div className="flex items-center h-[22px] bg-forge-gutter border-t border-border px-3 text-[10px] font-mono-code select-none shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3 flex-1">
        {/* Agent status with pulse */}
        <div className={cn("flex items-center gap-1.5", sc.color)}>
          {agentStatus === "running" || agentStatus === "thinking" ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : (
            <Circle className="w-2 h-2 fill-current" />
          )}
          <span>Hermes: {sc.label}</span>
        </div>

        {currentRun && (
          <span className="text-muted-foreground/30">
            {currentRun.plan.filter((s) => s.status === "complete").length}/{currentRun.plan.length} steps
          </span>
        )}
      </div>

      {/* Center */}
      <div className="flex items-center gap-3 text-muted-foreground/30">
        <div className="flex items-center gap-1">
          <GitBranch className="w-2.5 h-2.5" />
          <span>main</span>
        </div>
        {settings.selectedModelId && (
          <span className="text-forge-amber/40 truncate max-w-[120px]">
            {settings.selectedModelId.split("/").pop()}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 flex-1 justify-end text-muted-foreground/30">
        <span>UTF-8</span>
        <span>TypeScript</span>
        <span>Ln 1, Col 1</span>
      </div>
    </div>
  );
}

function RightPanelContent() {
  const { rightPanel } = useIDEStore();

  switch (rightPanel) {
    case "agent": return <AgentPanel />;
    case "chat": return <ChatThread />;
    case "approvals": return <ApprovalsQueue />;
    case "settings": return <SettingsPanel />;
    default: return null;
  }
}

export default function Workspace() {
  const { rightPanel, terminalOpen } = useIDEStore();
  const showRightPanel = rightPanel !== "none";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        <ActivityBar />

        <PanelGroup direction="horizontal" className="flex-1">
          {/* File tree panel */}
          <Panel defaultSize={15} minSize={10} maxSize={25}>
            <FileTree />
          </Panel>

          <PanelResizeHandle className="w-[1px] bg-border hover:bg-forge-amber/30 transition-colors" />

          {/* Editor + Terminal panel */}
          <Panel defaultSize={showRightPanel ? 55 : 85} minSize={30}>
            <PanelGroup direction="vertical">
              {/* Editor */}
              <Panel defaultSize={terminalOpen ? 65 : 100} minSize={20}>
                <CodeEditor />
              </Panel>

              {/* Terminal */}
              {terminalOpen && (
                <>
                  <PanelResizeHandle className="h-[1px] bg-border hover:bg-forge-amber/30 transition-colors" />
                  <Panel defaultSize={35} minSize={10} maxSize={60}>
                    <Suspense fallback={
                      <div className="h-full bg-[#0D0F12] flex items-center justify-center text-muted-foreground/30 text-[11px]">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading terminal...
                      </div>
                    }>
                      <TerminalPanel />
                    </Suspense>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {/* Right panel */}
          {showRightPanel && (
            <>
              <PanelResizeHandle className="w-[1px] bg-border hover:bg-forge-amber/30 transition-colors" />
              <Panel defaultSize={30} minSize={20} maxSize={45}>
                <RightPanelContent />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar />
      <CommandPalette />
    </div>
  );
}
