/*
 * Obsidian Forge — Agent Run Panel
 * Industrial step ticker timeline with status dots, tool call details, and forge pulse on active steps.
 */
import { useState } from "react";
import {
  CheckCircle2, Circle, Loader2, XCircle, SkipForward,
  ChevronDown, ChevronRight, Terminal, FileText, Search,
  Trash2, Play, Pause, RotateCcw
} from "lucide-react";
import { useIDEStore, type PlanStep, type ToolCall, type AgentStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

function StatusDot({ status }: { status: PlanStep["status"] }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="w-4 h-4 text-forge-teal shrink-0 step-complete-anim" />;
    case "active":
      return (
        <div className="relative shrink-0">
          <Circle className="w-4 h-4 text-forge-amber fill-forge-amber" />
          <div className="absolute inset-0 rounded-full bg-forge-amber/30 animate-ping" />
        </div>
      );
    case "failed":
      return <XCircle className="w-4 h-4 text-forge-coral shrink-0" />;
    case "skipped":
      return <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />;
  }
}

function ToolCallIcon({ tool }: { tool: string }) {
  if (tool.includes("terminal") || tool.includes("run")) return <Terminal className="w-3 h-3" />;
  if (tool.includes("file") || tool.includes("write") || tool.includes("read")) return <FileText className="w-3 h-3" />;
  if (tool.includes("search")) return <Search className="w-3 h-3" />;
  if (tool.includes("delete") || tool.includes("rm")) return <Trash2 className="w-3 h-3" />;
  return <Play className="w-3 h-3" />;
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const statusColors: Record<string, string> = {
    pending: "text-muted-foreground",
    running: "text-forge-amber",
    success: "text-forge-teal",
    failed: "text-forge-coral",
  };

  return (
    <div className="flex items-start gap-2 py-1 px-2 rounded bg-forge-gutter/50 text-[11px]">
      <div className={cn("mt-0.5", statusColors[tc.status])}>
        <ToolCallIcon tool={tc.tool} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono-code text-foreground/80">{tc.tool}</span>
          {tc.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-forge-amber" />}
          {tc.riskLevel === "high" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-forge-coral/20 text-forge-coral font-semibold uppercase">
              risky
            </span>
          )}
        </div>
        <div className="text-muted-foreground/60 font-mono-code truncate mt-0.5">
          {JSON.stringify(tc.args).slice(0, 80)}
        </div>
        {tc.result && (
          <div className="text-muted-foreground/50 font-mono-code mt-0.5 truncate">
            → {tc.result}
          </div>
        )}
      </div>
    </div>
  );
}

function StepItem({ step, index }: { step: PlanStep; index: number }) {
  const [expanded, setExpanded] = useState(step.status === "active");

  const elapsed = step.startedAt
    ? step.completedAt
      ? `${((step.completedAt - step.startedAt) / 1000).toFixed(1)}s`
      : `${((Date.now() - step.startedAt) / 1000).toFixed(0)}s...`
    : null;

  return (
    <div className={cn(
      "relative",
      step.status === "active" && "forge-pulse-border"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-start gap-2 w-full px-3 py-2 text-left transition-colors duration-100",
          "hover:bg-forge-surface-raised",
          step.status === "active" && "bg-forge-surface-raised/50"
        )}
      >
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <StatusDot status={step.status} />
          {/* Timeline connector */}
          <div className={cn(
            "w-px flex-1 min-h-[8px]",
            step.status === "complete" ? "bg-forge-teal/30" : "bg-border"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[12px] font-medium",
              step.status === "active" ? "text-forge-amber" :
              step.status === "complete" ? "text-foreground" : "text-muted-foreground"
            )}>
              {index + 1}. {step.title}
            </span>
            {elapsed && (
              <span className="text-[10px] text-muted-foreground/50 font-mono-code">{elapsed}</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">
            {step.description}
          </p>
        </div>
        {step.toolCalls && step.toolCalls.length > 0 && (
          expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>
      {expanded && step.toolCalls && step.toolCalls.length > 0 && (
        <div className="pl-9 pr-3 pb-2 space-y-1">
          {step.toolCalls.map((tc) => (
            <ToolCallItem key={tc.id} tc={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> = {
    idle: { label: "Idle", color: "text-muted-foreground", icon: <Circle className="w-2 h-2" /> },
    thinking: { label: "Thinking", color: "text-forge-amber", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    running: { label: "Running", color: "text-forge-amber", icon: <Play className="w-3 h-3" /> },
    waiting_approval: { label: "Waiting", color: "text-yellow-400", icon: <Pause className="w-3 h-3" /> },
    error: { label: "Error", color: "text-forge-coral", icon: <XCircle className="w-3 h-3" /> },
    disconnected: { label: "Disconnected", color: "text-muted-foreground", icon: <XCircle className="w-3 h-3" /> },
  };
  const c = config[status];

  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", c.color)}>
      {c.icon}
      {c.label}
    </div>
  );
}

export default function AgentPanel() {
  const { currentRun, agentStatus } = useIDEStore();

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663334932816/NySiUCnVhDhjqciPuE4bRd/agent-avatar-SXWBPzjYmAUnkgKGXLrf7U.webp"
            alt="Hermes"
            className="w-5 h-5 rounded"
          />
          <span className="text-[12px] font-semibold text-foreground">Hermes Agent</span>
        </div>
        <AgentStatusBadge status={agentStatus} />
      </div>

      {/* Run title */}
      {currentRun && (
        <div className="px-3 py-2 border-b border-border">
          <p className="text-[12px] font-medium text-foreground truncate">{currentRun.title}</p>
          <p className="text-[10px] text-muted-foreground/60 font-mono-code mt-0.5">
            {currentRun.plan.filter((s) => s.status === "complete").length}/{currentRun.plan.length} steps
          </p>
        </div>
      )}

      {/* Plan steps */}
      <div className="flex-1 overflow-y-auto">
        {currentRun ? (
          <div className="py-1">
            {currentRun.plan.map((step, i) => (
              <StepItem key={step.id} step={step} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-forge-surface-raised flex items-center justify-center">
                <Play className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[12px] text-muted-foreground">No active run</p>
              <p className="text-[10px] text-muted-foreground/50">
                Send a message to start the agent
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {currentRun && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
          <button className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-forge-surface-raised hover:bg-forge-surface-overlay text-muted-foreground hover:text-foreground transition-colors">
            <Pause className="w-3 h-3" /> Pause
          </button>
          <button className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-forge-surface-raised hover:bg-forge-surface-overlay text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> Restart
          </button>
        </div>
      )}
    </div>
  );
}
