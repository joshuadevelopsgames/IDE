/*
 * Obsidian Forge — Approvals Queue
 * Industrial "stamp card" design for risky actions. Clear Allow/Deny with Always Allow option.
 */
import {
  ShieldAlert, ShieldCheck, ShieldX, Terminal, FileText,
  AlertTriangle, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { useIDEStore, type ApprovalRequest } from "@/lib/store";
import { cn } from "@/lib/utils";

function RiskBadge({ level }: { level: ApprovalRequest["riskLevel"] }) {
  const config = {
    low: { label: "Low Risk", color: "bg-forge-teal/15 text-forge-teal border-forge-teal/20" },
    medium: { label: "Medium Risk", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
    high: { label: "High Risk", color: "bg-forge-coral/15 text-forge-coral border-forge-coral/20" },
  };
  const c = config[level];

  return (
    <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border", c.color)}>
      {c.label}
    </span>
  );
}

function ApprovalCard({ approval }: { approval: ApprovalRequest }) {
  const { resolveApproval } = useIDEStore();
  const isPending = approval.status === "pending";

  const toolIcon = approval.toolCall.tool.includes("terminal") || approval.toolCall.tool.includes("run")
    ? <Terminal className="w-4 h-4" />
    : <FileText className="w-4 h-4" />;

  return (
    <div className={cn(
      "mx-3 mb-2 rounded border transition-all duration-200",
      isPending
        ? "border-forge-amber/30 bg-forge-surface-raised"
        : approval.status === "approved"
        ? "border-forge-teal/20 bg-forge-teal/5 opacity-60"
        : "border-forge-coral/20 bg-forge-coral/5 opacity-60"
    )}>
      {/* Stamp header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          {isPending ? (
            <ShieldAlert className="w-4 h-4 text-forge-amber" />
          ) : approval.status === "approved" ? (
            <ShieldCheck className="w-4 h-4 text-forge-teal" />
          ) : (
            <ShieldX className="w-4 h-4 text-forge-coral" />
          )}
          <span className="text-[11px] font-semibold text-foreground">
            {isPending ? "Approval Required" : approval.status === "approved" ? "Approved" : "Denied"}
          </span>
        </div>
        <RiskBadge level={approval.riskLevel} />
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        <p className="text-[12px] text-foreground/80">{approval.description}</p>

        {/* Tool call details */}
        <div className="flex items-start gap-2 bg-forge-gutter/50 rounded px-2 py-1.5">
          <div className="text-muted-foreground mt-0.5">{toolIcon}</div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono-code text-forge-amber-dim">
              {approval.toolCall.tool}
            </span>
            <div className="text-[10px] font-mono-code text-muted-foreground/50 mt-0.5 break-all">
              {JSON.stringify(approval.toolCall.args, null, 0).slice(0, 120)}
            </div>
          </div>
        </div>

        {/* Warning for high risk */}
        {approval.riskLevel === "high" && isPending && (
          <div className="flex items-start gap-1.5 text-[10px] text-forge-coral/80">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>This action may modify or delete files. Review carefully before approving.</span>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
          <Clock className="w-2.5 h-2.5" />
          {new Date(approval.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
          <button
            onClick={() => resolveApproval(approval.id, false)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded bg-forge-coral/15 text-forge-coral hover:bg-forge-coral/25 transition-colors"
          >
            <XCircle className="w-3 h-3" /> Deny
          </button>
          <button
            onClick={() => resolveApproval(approval.id, true, false)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded bg-forge-teal/15 text-forge-teal hover:bg-forge-teal/25 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" /> Allow once
          </button>
          <button
            onClick={() => resolveApproval(approval.id, true, true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded bg-forge-amber/15 text-forge-amber hover:bg-forge-amber/25 transition-colors"
          >
            <ShieldCheck className="w-3 h-3" /> Always allow
          </button>
        </div>
      )}

      {/* Resolved status */}
      {!isPending && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border/50">
          {approval.status === "approved" ? (
            <CheckCircle2 className="w-3 h-3 text-forge-teal" />
          ) : (
            <XCircle className="w-3 h-3 text-forge-coral" />
          )}
          <span className="text-[10px] text-muted-foreground/50">
            {approval.status === "approved" ? "Approved" : "Denied"}
            {approval.alwaysAllow && " (always)"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsQueue() {
  const { currentRun } = useIDEStore();
  const approvals = currentRun?.approvals || [];
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">Approvals</span>
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-forge-amber text-forge-gutter">
              {pendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-y-auto py-2">
        {approvals.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-forge-surface-raised flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-[12px] text-muted-foreground">No pending approvals</p>
              <p className="text-[10px] text-muted-foreground/40">
                Risky actions will appear here for review
              </p>
            </div>
          </div>
        ) : (
          approvals.map((a) => <ApprovalCard key={a.id} approval={a} />)
        )}
      </div>
    </div>
  );
}
