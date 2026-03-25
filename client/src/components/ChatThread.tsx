/*
 * Obsidian Forge — Unified Run View (Chat + Agent Output)
 *
 * Cursor-style structured output: the chat IS the run view.
 * Instead of text-message bubbles, renders structured blocks:
 *   - Collapsible thinking/reasoning
 *   - Step progress cards
 *   - File diff cards (unified diff with syntax highlighting)
 *   - Terminal output cards
 *   - Search result cards
 *   - Streaming response text
 *   - Approval cards inline
 *   - Summary blocks
 *
 * Each block corresponds to an ACP event from Hermes.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, User, Bot, Terminal, Loader2, Paperclip, Brain,
  ChevronDown, ChevronRight, FileText, Search, CheckCircle2,
  XCircle, Circle, Shield, Clock, Copy, Check, Eye,
  GitBranch, Play, AlertTriangle, Sparkles
} from "lucide-react";
import { Streamdown } from "streamdown";
import { useIDEStore, type ChatMessage } from "@/lib/store";
import {
  hermesBridge,
  type ACPEvent, type ThinkingData, type StepData,
  type ToolCallStartData, type ToolProgressData, type ToolCallEndData,
  type StreamDeltaData, type PermissionRequestData
} from "@/lib/hermes-bridge";
import { cn } from "@/lib/utils";

// ─── Block Types (rendered in the run stream) ───────────────────────

interface RunBlock {
  id: string;
  type: "user_message" | "thinking" | "step" | "tool_call" | "file_diff" |
        "terminal_output" | "search_results" | "text_preview" |
        "stream_response" | "permission_request" | "summary" | "error";
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

// ─── Thinking Block ─────────────────────────────────────────────────

function ThinkingBlock({ data }: { data: ThinkingData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mx-3 my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <div className="w-5 h-5 rounded bg-forge-surface-overlay flex items-center justify-center shrink-0">
          <Brain className="w-3 h-3 text-muted-foreground/50" />
        </div>
        <span className="text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          {data.isComplete ? "Thought process" : "Thinking..."}
        </span>
        {!data.isComplete && <Loader2 className="w-3 h-3 animate-spin text-forge-amber/50" />}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground/30 ml-auto" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground/30 ml-auto" />
        }
      </button>
      {expanded && (
        <div className="ml-7 mt-1.5 pl-3 border-l-2 border-forge-surface-overlay">
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed whitespace-pre-wrap">
            {data.content}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step Block ─────────────────────────────────────────────────────

function StepBlock({ data }: { data: StepData }) {
  const statusIcon = {
    planned: <Circle className="w-3 h-3 text-muted-foreground/30" />,
    active: (
      <div className="relative">
        <Loader2 className="w-3 h-3 text-forge-amber animate-spin" />
      </div>
    ),
    complete: <CheckCircle2 className="w-3 h-3 text-forge-teal" />,
    failed: <XCircle className="w-3 h-3 text-forge-coral" />,
    skipped: <Circle className="w-3 h-3 text-muted-foreground/20" />,
  };

  return (
    <div className="mx-3 my-1">
      <div className="flex items-center gap-2">
        {statusIcon[data.status]}
        <span className={cn(
          "text-[11px] font-medium",
          data.status === "active" ? "text-forge-amber" :
          data.status === "complete" ? "text-foreground/70" :
          data.status === "failed" ? "text-forge-coral" :
          "text-muted-foreground/40"
        )}>
          {data.stepIndex + 1}. {data.title}
        </span>
        {data.elapsed && (
          <span className="text-[9px] text-muted-foreground/30 font-mono-code ml-auto">
            {(data.elapsed / 1000).toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}

// ─── File Diff Block ────────────────────────────────────────────────

function FileDiffBlock({ data }: { data: ToolProgressData }) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const lines = (data.diff || "").split("\n");
  const additions = lines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
  const deletions = lines.filter(l => l.startsWith("-") && !l.startsWith("---")).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(data.diff || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-3 my-2 rounded-lg border border-border overflow-hidden bg-forge-surface">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-1.5 bg-forge-gutter hover:bg-forge-surface-raised transition-colors"
      >
        <FileText className="w-3 h-3 text-forge-amber shrink-0" />
        <span className="text-[11px] font-mono-code text-foreground/80 truncate">
          {data.filePath}
        </span>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {additions > 0 && (
            <span className="text-[9px] font-mono-code text-forge-teal">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-[9px] font-mono-code text-forge-coral">-{deletions}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="p-0.5 rounded hover:bg-forge-surface-overlay text-muted-foreground/40 hover:text-muted-foreground"
          >
            {copied ? <Check className="w-3 h-3 text-forge-teal" /> : <Copy className="w-3 h-3" />}
          </button>
          {expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground/30" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
          }
        </div>
      </button>

      {/* Diff content */}
      {expanded && (
        <div className="overflow-x-auto">
          <pre className="text-[11px] font-mono-code leading-[1.6]">
            {lines.map((line, i) => {
              const isAdd = line.startsWith("+") && !line.startsWith("+++");
              const isDel = line.startsWith("-") && !line.startsWith("---");
              const isHeader = line.startsWith("@@");
              const isMeta = line.startsWith("---") || line.startsWith("+++");

              return (
                <div
                  key={i}
                  className={cn(
                    "px-3 py-0",
                    isAdd && "bg-forge-teal/8 text-forge-teal",
                    isDel && "bg-forge-coral/8 text-forge-coral",
                    isHeader && "text-forge-amber/50 bg-forge-amber/5",
                    isMeta && "text-muted-foreground/30",
                    !isAdd && !isDel && !isHeader && !isMeta && "text-muted-foreground/50"
                  )}
                >
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Terminal Output Block ──────────────────────────────────────────

function TerminalOutputBlock({ data }: { data: ToolProgressData }) {
  const [expanded, setExpanded] = useState(true);
  const isSuccess = data.exitCode === 0;

  return (
    <div className="mx-3 my-2 rounded-lg border border-border overflow-hidden bg-forge-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-1.5 bg-forge-gutter hover:bg-forge-surface-raised transition-colors"
      >
        <Terminal className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        <code className="text-[11px] font-mono-code text-foreground/70 truncate">
          {data.command}
        </code>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {data.exitCode !== undefined && (
            <span className={cn(
              "text-[9px] font-mono-code",
              isSuccess ? "text-forge-teal" : "text-forge-coral"
            )}>
              exit {data.exitCode}
            </span>
          )}
          {expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground/30" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
          }
        </div>
      </button>
      {expanded && data.output && (
        <pre className="px-3 py-2 text-[10px] font-mono-code text-muted-foreground/60 leading-[1.5] overflow-x-auto max-h-[200px] overflow-y-auto">
          {data.output}
        </pre>
      )}
    </div>
  );
}

// ─── Search Results Block ───────────────────────────────────────────

function SearchResultsBlock({ data }: { data: ToolProgressData }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-border overflow-hidden bg-forge-surface">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-forge-gutter">
        <Search className="w-3 h-3 text-muted-foreground/50" />
        <span className="text-[11px] text-foreground/70">
          {data.results?.length || 0} results found
        </span>
      </div>
      <div className="divide-y divide-border">
        {data.results?.slice(0, 5).map((r, i) => (
          <div key={i} className="px-3 py-1.5 hover:bg-forge-surface-raised/50 transition-colors">
            <div className="flex items-center gap-2">
              <FileText className="w-2.5 h-2.5 text-muted-foreground/30 shrink-0" />
              <span className="text-[10px] font-mono-code text-forge-amber/70 truncate">{r.path}</span>
              <span className="text-[9px] font-mono-code text-muted-foreground/25">:{r.line}</span>
            </div>
            <p className="text-[10px] font-mono-code text-muted-foreground/40 truncate ml-4.5 mt-0.5">
              {r.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tool Call Header ───────────────────────────────────────────────

function ToolCallHeader({ data, endData }: { data: ToolCallStartData; endData?: ToolCallEndData }) {
  const kindIcons: Record<string, React.ReactNode> = {
    file_edit: <FileText className="w-3 h-3 text-forge-amber" />,
    file_read: <Eye className="w-3 h-3 text-muted-foreground/50" />,
    terminal: <Terminal className="w-3 h-3 text-muted-foreground/50" />,
    search: <Search className="w-3 h-3 text-muted-foreground/50" />,
    web: <Sparkles className="w-3 h-3 text-muted-foreground/50" />,
    memory: <Brain className="w-3 h-3 text-muted-foreground/50" />,
    other: <Play className="w-3 h-3 text-muted-foreground/50" />,
  };

  const isRunning = !endData;
  const isSuccess = endData?.status === "success";

  return (
    <div className="mx-3 my-1 flex items-center gap-2">
      {kindIcons[data.kind] || kindIcons.other}
      <span className="text-[11px] font-mono-code text-foreground/60">
        {data.tool}
      </span>
      {isRunning && <Loader2 className="w-3 h-3 animate-spin text-forge-amber/50" />}
      {endData && (
        <span className={cn(
          "text-[9px] font-mono-code",
          isSuccess ? "text-forge-teal/60" : "text-forge-coral/60"
        )}>
          {endData.summary}
        </span>
      )}
    </div>
  );
}

// ─── Permission Request Block ───────────────────────────────────────

function PermissionBlock({ data }: { data: PermissionRequestData }) {
  const [resolved, setResolved] = useState(false);

  const handleAction = (action: "allow_once" | "allow_always" | "deny") => {
    hermesBridge.respondToPermission(data.requestId, action);
    setResolved(true);
  };

  const riskColors = {
    low: "border-forge-teal/30 bg-forge-teal/5",
    medium: "border-forge-amber/30 bg-forge-amber/5",
    high: "border-forge-coral/30 bg-forge-coral/5",
  };

  return (
    <div className={cn(
      "mx-3 my-2 rounded-lg border p-3",
      riskColors[data.riskLevel]
    )}>
      <div className="flex items-start gap-2">
        <Shield className={cn(
          "w-4 h-4 shrink-0 mt-0.5",
          data.riskLevel === "high" ? "text-forge-coral" :
          data.riskLevel === "medium" ? "text-forge-amber" :
          "text-forge-teal"
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground/80">
            {data.description}
          </p>
          {data.command && (
            <code className="text-[10px] font-mono-code text-muted-foreground/60 mt-1 block">
              $ {data.command}
            </code>
          )}
          {!resolved ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleAction("allow_once")}
                className="px-2 py-1 text-[10px] rounded bg-forge-teal/20 text-forge-teal hover:bg-forge-teal/30 transition-colors font-medium"
              >
                Allow once
              </button>
              <button
                onClick={() => handleAction("allow_always")}
                className="px-2 py-1 text-[10px] rounded bg-forge-amber/20 text-forge-amber hover:bg-forge-amber/30 transition-colors font-medium"
              >
                Always allow
              </button>
              <button
                onClick={() => handleAction("deny")}
                className="px-2 py-1 text-[10px] rounded bg-forge-coral/20 text-forge-coral hover:bg-forge-coral/30 transition-colors font-medium"
              >
                Deny
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/40 mt-1">Resolved</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Streaming Response Block ───────────────────────────────────────

function ResponseBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
    <div className="mx-3 my-2">
      <div className="prose prose-sm prose-invert max-w-none text-[12.5px] leading-relaxed
        [&_p]:my-1.5 [&_code]:text-forge-amber [&_code]:bg-forge-gutter/50 [&_code]:px-1 [&_code]:rounded
        [&_pre]:bg-forge-gutter [&_pre]:rounded [&_pre]:p-3 [&_pre]:text-[11px]
        [&_strong]:text-foreground [&_h1]:text-[16px] [&_h2]:text-[14px] [&_h3]:text-[13px]
        [&_li]:my-0.5 [&_ul]:my-1 [&_ol]:my-1
        text-foreground/85">
        <Streamdown>{content}</Streamdown>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-forge-amber/60 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
}

// ─── User Message Block ─────────────────────────────────────────────

function UserMessageBlock({ content }: { content: string }) {
  return (
    <div className="mx-3 my-3 flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-forge-amber/15 flex items-center justify-center shrink-0">
        <User className="w-3.5 h-3.5 text-forge-amber" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[12.5px] text-foreground leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function ChatThread() {
  const { currentRun, addMessage, startRun, agentStatus, setAgentStatus } = useIDEStore();
  const [input, setInput] = useState("");
  const [blocks, setBlocks] = useState<RunBlock[]>([]);
  const [streamContent, setStreamContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStarts, setToolStarts] = useState<Map<string, ToolCallStartData>>(new Map());
  const [toolEnds, setToolEnds] = useState<Map<string, ToolCallEndData>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [blocks.length, streamContent]);

  // Listen to ACP events from Hermes bridge
  useEffect(() => {
    const unsub = hermesBridge.on("*", (event: ACPEvent) => {
      switch (event.type) {
        case "thinking": {
          const d = event.data as ThinkingData;
          setBlocks(prev => {
            const existing = prev.findIndex(b => b.type === "thinking" && !(b.data as ThinkingData).isComplete);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { ...updated[existing], data: d };
              return updated;
            }
            return [...prev, { id: crypto.randomUUID(), type: "thinking", timestamp: event.timestamp, data: d }];
          });
          setAgentStatus("thinking");
          break;
        }

        case "step": {
          const d = event.data as StepData;
          setBlocks(prev => {
            const existing = prev.findIndex(b => b.type === "step" && (b.data as StepData).stepId === d.stepId);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { ...updated[existing], data: d };
              return updated;
            }
            return [...prev, { id: crypto.randomUUID(), type: "step", timestamp: event.timestamp, data: d }];
          });
          if (d.status === "active") setAgentStatus("running");
          break;
        }

        case "tool_call_start": {
          const d = event.data as ToolCallStartData;
          setToolStarts(prev => new Map(prev).set(d.toolCallId, d));
          setBlocks(prev => [...prev, {
            id: crypto.randomUUID(),
            type: "tool_call",
            timestamp: event.timestamp,
            data: d,
          }]);
          break;
        }

        case "tool_progress": {
          const d = event.data as ToolProgressData;
          const blockType = d.kind === "file_diff" ? "file_diff" :
                           d.kind === "terminal_output" ? "terminal_output" :
                           d.kind === "search_results" ? "search_results" :
                           "text_preview";
          setBlocks(prev => [...prev, {
            id: crypto.randomUUID(),
            type: blockType,
            timestamp: event.timestamp,
            data: d,
          }]);
          break;
        }

        case "tool_call_end": {
          const d = event.data as ToolCallEndData;
          setToolEnds(prev => new Map(prev).set(d.toolCallId, d));
          break;
        }

        case "stream_delta": {
          const d = event.data as StreamDeltaData;
          setIsStreaming(!d.isComplete);
          setStreamContent(prev => prev + d.content);
          break;
        }

        case "message": {
          setIsStreaming(false);
          setAgentStatus("idle");
          break;
        }

        case "permission_request": {
          const d = event.data as PermissionRequestData;
          setBlocks(prev => [...prev, {
            id: crypto.randomUUID(),
            type: "permission_request",
            timestamp: event.timestamp,
            data: d,
          }]);
          setAgentStatus("waiting_approval");
          break;
        }

        case "connected":
          setAgentStatus("idle");
          break;

        case "disconnected":
          setAgentStatus("disconnected");
          break;
      }
    });

    return unsub;
  }, [setAgentStatus]);

  // Auto-connect Hermes on mount
  useEffect(() => {
    if (!hermesBridge.isConnected()) {
      hermesBridge.start({
        hermesPath: "",
        workingDirectory: "/home/user/project",
        modelProvider: "nous",
        apiKey: "",
        maxConcurrentTools: 3,
      });
    }
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    if (!currentRun) {
      startRun(text.slice(0, 60));
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    });

    // Add user message block
    setBlocks(prev => [...prev, {
      id: crypto.randomUUID(),
      type: "user_message",
      timestamp: Date.now(),
      data: { content: text },
    }]);

    // Reset streaming state
    setStreamContent("");
    setIsStreaming(false);

    setInput("");

    // Send to Hermes via ACP
    hermesBridge.prompt(text);
  }, [input, currentRun, startRun, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663334932816/NySiUCnVhDhjqciPuE4bRd/agent-avatar-SXWBPzjYmAUnkgKGXLrf7U.webp"
            alt="Hermes"
            className="w-5 h-5 rounded"
          />
          <span className="text-[12px] font-semibold text-foreground">Hermes</span>
        </div>
        <div className="flex items-center gap-1.5">
          {agentStatus === "thinking" && (
            <div className="flex items-center gap-1 text-[10px] text-forge-amber">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Thinking</span>
            </div>
          )}
          {agentStatus === "running" && (
            <div className="flex items-center gap-1 text-[10px] text-forge-amber">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Working</span>
            </div>
          )}
          {agentStatus === "idle" && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
              <Circle className="w-2 h-2 fill-current" />
              <span>Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Run stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
        {blocks.length === 0 && !streamContent ? (
          <div className="flex-1 flex items-center justify-center h-full p-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-forge-surface-raised flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-[13px] font-medium text-foreground/60">What can I help you build?</p>
              <p className="text-[11px] text-muted-foreground/30 max-w-[260px] leading-relaxed">
                Describe a task and Hermes will plan, implement, and verify the changes.
                You'll see every step, file change, and command before it runs.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center pt-2 max-w-[300px] mx-auto">
                {["Add dark mode", "Fix the login bug", "Refactor to TypeScript", "Add API endpoint"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="px-2 py-1 text-[10px] rounded-full border border-border text-muted-foreground/40 hover:text-muted-foreground hover:border-forge-amber/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {blocks.map((block) => {
              switch (block.type) {
                case "user_message":
                  return <UserMessageBlock key={block.id} content={block.data.content as string} />;
                case "thinking":
                  return <ThinkingBlock key={block.id} data={block.data as ThinkingData} />;
                case "step":
                  return <StepBlock key={block.id} data={block.data as StepData} />;
                case "tool_call": {
                  const tcData = block.data as ToolCallStartData;
                  const endData = toolEnds.get(tcData.toolCallId);
                  return <ToolCallHeader key={block.id} data={tcData} endData={endData} />;
                }
                case "file_diff":
                  return <FileDiffBlock key={block.id} data={block.data as ToolProgressData} />;
                case "terminal_output":
                  return <TerminalOutputBlock key={block.id} data={block.data as ToolProgressData} />;
                case "search_results":
                  return <SearchResultsBlock key={block.id} data={block.data as ToolProgressData} />;
                case "permission_request":
                  return <PermissionBlock key={block.id} data={block.data as PermissionRequestData} />;
                default:
                  return null;
              }
            })}

            {/* Streaming response */}
            {streamContent && (
              <ResponseBlock content={streamContent} isStreaming={isStreaming} />
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-2 shrink-0">
        <div className="flex items-end gap-2 bg-forge-surface-raised rounded-lg px-3 py-2">
          <button className="p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0 mb-0.5">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build or change..."
            rows={1}
            className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/25 resize-none outline-none min-h-[20px] max-h-[120px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "p-1.5 rounded transition-colors shrink-0 mb-0.5",
              input.trim()
                ? "bg-forge-amber text-forge-gutter hover:bg-forge-amber/90"
                : "text-muted-foreground/15"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/20 mt-1 px-1">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
