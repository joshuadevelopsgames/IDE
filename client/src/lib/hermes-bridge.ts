/*
 * Obsidian Forge — Hermes Agent Bridge (ACP Protocol)
 *
 * Implements the ACP (Agent Communication Protocol) used by Hermes Agent.
 * ACP is JSON-RPC 2.0 over stdio — Hermes is spawned as a sidecar process.
 *
 * In the Tauri desktop build:
 *   - Tauri spawns `hermes acp` as a child process
 *   - stdin/stdout carry JSON-RPC traffic
 *   - stderr carries human-readable logs
 *
 * In the web prototype:
 *   - Simulates the ACP event stream with realistic event shapes
 *   - Uses the exact same types so the UI is ready for real integration
 *
 * ACP Session Lifecycle:
 *   new_session(cwd) → prompt(text, session_id) → session_update events → response
 *   cancel(session_id) / fork_session(session_id)
 *
 * ACP Event Bridge (session_update notifications):
 *   thinking_callback    → ThinkingEvent
 *   reasoning_callback   → ReasoningEvent
 *   step_callback         → StepEvent
 *   tool_progress_callback → ToolProgressEvent
 *   stream_delta_callback → StreamDeltaEvent
 *   message_callback      → MessageEvent
 *   Permission bridge     → PermissionRequestEvent
 */

// ─── ACP Event Types (matching Hermes callbacks) ────────────────────

export type ACPEventType =
  | "connected"
  | "disconnected"
  | "session_created"
  | "thinking"           // agent chain-of-thought (collapsible)
  | "reasoning"          // extended reasoning trace
  | "step"               // plan step progress
  | "tool_call_start"    // tool invocation begins
  | "tool_progress"      // tool execution progress (file diffs, terminal output)
  | "tool_call_end"      // tool invocation completes
  | "stream_delta"       // token-by-token response streaming
  | "message"            // final response chunk
  | "permission_request" // approval needed for dangerous action
  | "clarify"            // agent asking for clarification
  | "error"
  | "status_change";

// ─── Structured Event Data ──────────────────────────────────────────

export interface ThinkingData {
  content: string;
  isComplete: boolean;
}

export interface ReasoningData {
  content: string;
  isComplete: boolean;
}

export interface StepData {
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  title: string;
  description: string;
  status: "planned" | "active" | "complete" | "failed" | "skipped";
  elapsed?: number;
}

export interface ToolCallStartData {
  toolCallId: string;
  tool: string;
  args: Record<string, unknown>;
  kind: "file_edit" | "file_read" | "terminal" | "search" | "web" | "memory" | "other";
}

export interface ToolProgressData {
  toolCallId: string;
  tool: string;
  kind: "file_diff" | "terminal_output" | "search_results" | "text_preview" | "progress";
  // For file_diff
  filePath?: string;
  diff?: string;
  language?: string;
  // For terminal_output
  command?: string;
  output?: string;
  exitCode?: number;
  // For search_results
  results?: Array<{ path: string; line: number; content: string }>;
  // For text_preview
  content?: string;
  // For progress
  message?: string;
  percent?: number;
}

export interface ToolCallEndData {
  toolCallId: string;
  tool: string;
  status: "success" | "failed" | "cancelled";
  summary?: string;
  error?: string;
}

export interface StreamDeltaData {
  content: string;
  isComplete: boolean;
}

export interface MessageData {
  content: string;
  role: "assistant";
  isComplete: boolean;
}

export interface PermissionRequestData {
  requestId: string;
  toolCallId: string;
  tool: string;
  command?: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  options: ("allow_once" | "allow_always" | "deny")[];
}

export interface ClarifyData {
  requestId: string;
  question: string;
  suggestions?: string[];
}

export interface ACPEvent {
  type: ACPEventType;
  sessionId: string;
  timestamp: number;
  data: ThinkingData | ReasoningData | StepData | ToolCallStartData |
        ToolProgressData | ToolCallEndData | StreamDeltaData | MessageData |
        PermissionRequestData | ClarifyData | Record<string, unknown>;
}

// ─── ACP Session ────────────────────────────────────────────────────

export interface ACPSession {
  sessionId: string;
  cwd: string;
  model: string;
  status: "idle" | "running" | "waiting" | "error";
  createdAt: number;
}

// ─── ACP Config ─────────────────────────────────────────────────────

export interface HermesConfig {
  hermesPath: string;
  workingDirectory: string;
  modelProvider: string;
  apiKey: string;
  maxConcurrentTools: number;
}

export interface HermesStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  model?: string;
  sessionId?: string;
  version?: string;
}

// ─── JSON-RPC Protocol ──────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// ─── Bridge Class ───────────────────────────────────────────────────

type EventHandler = (event: ACPEvent) => void;

export class HermesBridge {
  private listeners: Map<ACPEventType | "*", Set<EventHandler>> = new Map();
  private _status: HermesStatus = { running: false };
  private _config: HermesConfig | null = null;
  private _session: ACPSession | null = null;
  private messageId = 0;
  private simulationTimers: ReturnType<typeof setTimeout>[] = [];

  get status(): HermesStatus { return this._status; }
  get session(): ACPSession | null { return this._session; }

  // ─── Event Emitter ───────────────────────────────────────────────

  on(event: ACPEventType | "*", handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit(event: ACPEvent): void {
    this.listeners.get(event.type)?.forEach((h) => h(event));
    this.listeners.get("*")?.forEach((h) => h(event));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  async start(config: HermesConfig): Promise<void> {
    this._config = config;

    // In Tauri: invoke("hermes_start", { config })
    // which runs: `hermes acp` as a sidecar process
    this._status = {
      running: true,
      pid: 12345,
      uptime: 0,
      model: "hermes-3-llama-3.1-70b",
      version: "0.8.x",
    };

    // Create initial ACP session
    const sessionId = crypto.randomUUID();
    this._session = {
      sessionId,
      cwd: config.workingDirectory || "/home/user/project",
      model: "hermes-3-llama-3.1-70b",
      status: "idle",
      createdAt: Date.now(),
    };

    this.emit({
      type: "connected",
      sessionId,
      timestamp: Date.now(),
      data: { status: this._status },
    });

    this.emit({
      type: "session_created",
      sessionId,
      timestamp: Date.now(),
      data: { session: this._session },
    });
  }

  async stop(): Promise<void> {
    this.clearSimulation();
    const sid = this._session?.sessionId || "";
    this._status = { running: false };
    this._session = null;

    this.emit({
      type: "disconnected",
      sessionId: sid,
      timestamp: Date.now(),
      data: { reason: "user_stopped" },
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    if (this._config) await this.start(this._config);
  }

  // ─── ACP Methods ─────────────────────────────────────────────────

  async prompt(content: string): Promise<void> {
    if (!this._status.running || !this._session) {
      throw new Error("Hermes is not running");
    }

    const _request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: String(++this.messageId),
      method: "prompt",
      params: {
        session_id: this._session.sessionId,
        content: [{ type: "text", text: content }],
      },
    };

    // In Tauri: write JSON-RPC to Hermes stdin
    // In web prototype: simulate the full ACP event stream
    this._session.status = "running";
    this.simulateACPEventStream(content);
  }

  async respondToPermission(requestId: string, action: "allow_once" | "allow_always" | "deny"): Promise<void> {
    const _request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: String(++this.messageId),
      method: "permission_response",
      params: { request_id: requestId, action },
    };

    // In Tauri: write to Hermes stdin
    this.emit({
      type: "status_change",
      sessionId: this._session?.sessionId || "",
      timestamp: Date.now(),
      data: { status: action === "deny" ? "idle" : "running" },
    });
  }

  async respondToClarify(requestId: string, response: string): Promise<void> {
    const _request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: String(++this.messageId),
      method: "clarify_response",
      params: { request_id: requestId, response },
    };
  }

  async cancel(): Promise<void> {
    if (!this._session) return;
    this.clearSimulation();
    this._session.status = "idle";

    this.emit({
      type: "status_change",
      sessionId: this._session.sessionId,
      timestamp: Date.now(),
      data: { status: "cancelled" },
    });
  }

  // ─── Simulation (Web Prototype) ──────────────────────────────────

  private clearSimulation(): void {
    this.simulationTimers.forEach(clearTimeout);
    this.simulationTimers = [];
  }

  private schedule(delay: number, fn: () => void): void {
    this.simulationTimers.push(setTimeout(fn, delay));
  }

  private simulateACPEventStream(userMessage: string): void {
    this.clearSimulation();
    const sid = this._session?.sessionId || "";
    let t = 0;

    // 1. Thinking phase (collapsible chain-of-thought)
    t += 400;
    this.schedule(t, () => this.emit({
      type: "thinking",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        content: `Let me analyze this request. The user wants to ${userMessage.toLowerCase().slice(0, 80)}...\n\nI need to:\n1. Understand the current codebase structure\n2. Identify the relevant files\n3. Plan the implementation approach`,
        isComplete: false,
      } satisfies ThinkingData,
    }));

    t += 1200;
    this.schedule(t, () => this.emit({
      type: "thinking",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        content: `I'll start by reading the relevant files to understand the current implementation, then make targeted changes. I should be careful to preserve existing functionality while adding the new behavior.`,
        isComplete: true,
      } satisfies ThinkingData,
    }));

    // 2. Plan steps
    const steps = [
      { id: "s1", title: "Read project structure", desc: "Scanning workspace files and understanding the codebase layout" },
      { id: "s2", title: "Analyze relevant files", desc: "Reading and understanding the files that need modification" },
      { id: "s3", title: "Implement changes", desc: "Writing the code modifications" },
      { id: "s4", title: "Verify implementation", desc: "Checking for errors and validating the changes" },
    ];

    steps.forEach((step, i) => {
      t += 300;
      this.schedule(t, () => this.emit({
        type: "step",
        sessionId: sid,
        timestamp: Date.now(),
        data: {
          stepId: step.id,
          stepIndex: i,
          totalSteps: steps.length,
          title: step.title,
          description: step.desc,
          status: i === 0 ? "active" : "planned",
        } satisfies StepData,
      }));
    });

    // 3. Step 1: Read files (tool calls)
    t += 500;
    const tc1 = crypto.randomUUID();
    this.schedule(t, () => this.emit({
      type: "tool_call_start",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        toolCallId: tc1,
        tool: "search_files",
        args: { pattern: "**/*.{ts,tsx}", path: "src/" },
        kind: "search",
      } satisfies ToolCallStartData,
    }));

    t += 800;
    this.schedule(t, () => this.emit({
      type: "tool_progress",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        toolCallId: tc1,
        tool: "search_files",
        kind: "search_results",
        results: [
          { path: "src/App.tsx", line: 1, content: "import React from 'react';" },
          { path: "src/components/Header.tsx", line: 1, content: "export default function Header() {" },
          { path: "src/lib/utils.ts", line: 1, content: "import { clsx } from 'clsx';" },
        ],
      } satisfies ToolProgressData,
    }));

    t += 400;
    this.schedule(t, () => this.emit({
      type: "tool_call_end",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc1, tool: "search_files", status: "success", summary: "Found 12 matching files" } satisfies ToolCallEndData,
    }));

    // Step 1 complete
    t += 200;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s1", stepIndex: 0, totalSteps: 4, title: "Read project structure", description: "", status: "complete" } satisfies StepData,
    }));

    // 4. Step 2: Read specific file
    t += 300;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s2", stepIndex: 1, totalSteps: 4, title: "Analyze relevant files", description: "", status: "active" } satisfies StepData,
    }));

    const tc2 = crypto.randomUUID();
    t += 400;
    this.schedule(t, () => this.emit({
      type: "tool_call_start",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc2, tool: "read_file", args: { path: "src/App.tsx" }, kind: "file_read" } satisfies ToolCallStartData,
    }));

    t += 600;
    this.schedule(t, () => this.emit({
      type: "tool_progress",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        toolCallId: tc2,
        tool: "read_file",
        kind: "text_preview",
        content: `import React from 'react';\nimport { Router } from 'wouter';\nimport Home from './pages/Home';\n\nexport default function App() {\n  return (\n    <Router>\n      <Home />\n    </Router>\n  );\n}`,
      } satisfies ToolProgressData,
    }));

    t += 300;
    this.schedule(t, () => this.emit({
      type: "tool_call_end",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc2, tool: "read_file", status: "success", summary: "Read 11 lines" } satisfies ToolCallEndData,
    }));

    t += 200;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s2", stepIndex: 1, totalSteps: 4, title: "Analyze relevant files", description: "", status: "complete" } satisfies StepData,
    }));

    // 5. Step 3: Write file (with diff!)
    t += 300;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s3", stepIndex: 2, totalSteps: 4, title: "Implement changes", description: "", status: "active" } satisfies StepData,
    }));

    const tc3 = crypto.randomUUID();
    t += 500;
    this.schedule(t, () => this.emit({
      type: "tool_call_start",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc3, tool: "patch", args: { path: "src/App.tsx" }, kind: "file_edit" } satisfies ToolCallStartData,
    }));

    t += 800;
    this.schedule(t, () => this.emit({
      type: "tool_progress",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        toolCallId: tc3,
        tool: "patch",
        kind: "file_diff",
        filePath: "src/App.tsx",
        language: "typescript",
        diff: `--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,5 +1,7 @@\n import React from 'react';\n import { Router } from 'wouter';\n+import { ThemeProvider } from './contexts/ThemeContext';\n+import { Toaster } from './components/ui/sonner';\n import Home from './pages/Home';\n \n export default function App() {\n@@ -7,6 +9,10 @@\n   return (\n-    <Router>\n-      <Home />\n-    </Router>\n+    <ThemeProvider defaultTheme="dark">\n+      <Router>\n+        <Toaster />\n+        <Home />\n+      </Router>\n+    </ThemeProvider>\n   );\n }`,
      } satisfies ToolProgressData,
    }));

    // Permission request for a terminal command
    t += 600;
    const tc4 = crypto.randomUUID();
    this.schedule(t, () => this.emit({
      type: "tool_call_start",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc4, tool: "terminal", args: { command: "npm run build" }, kind: "terminal" } satisfies ToolCallStartData,
    }));

    t += 300;
    this.schedule(t, () => this.emit({
      type: "permission_request",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        requestId: crypto.randomUUID(),
        toolCallId: tc4,
        tool: "terminal",
        command: "npm run build",
        description: "Run build command to verify changes compile correctly",
        riskLevel: "low",
        options: ["allow_once", "allow_always", "deny"],
      } satisfies PermissionRequestData,
    }));

    // Simulate auto-approval after a moment
    t += 2000;
    this.schedule(t, () => this.emit({
      type: "tool_progress",
      sessionId: sid,
      timestamp: Date.now(),
      data: {
        toolCallId: tc4,
        tool: "terminal",
        kind: "terminal_output",
        command: "npm run build",
        output: "$ npm run build\n\n> project@1.0.0 build\n> vite build\n\n✓ 42 modules transformed.\ndist/index.html    0.46 kB │ gzip: 0.30 kB\ndist/assets/index-DiwrgTda.css  6.12 kB │ gzip: 1.87 kB\ndist/assets/index-CdFbHkOe.js  142.35 kB │ gzip: 46.12 kB\n✓ built in 1.23s",
        exitCode: 0,
      } satisfies ToolProgressData,
    }));

    t += 400;
    this.schedule(t, () => this.emit({
      type: "tool_call_end",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc4, tool: "terminal", status: "success", summary: "Build succeeded" } satisfies ToolCallEndData,
    }));

    t += 200;
    this.schedule(t, () => this.emit({
      type: "tool_call_end",
      sessionId: sid,
      timestamp: Date.now(),
      data: { toolCallId: tc3, tool: "patch", status: "success", summary: "Applied patch to src/App.tsx" } satisfies ToolCallEndData,
    }));

    t += 200;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s3", stepIndex: 2, totalSteps: 4, title: "Implement changes", description: "", status: "complete" } satisfies StepData,
    }));

    // 6. Step 4: Verify
    t += 300;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s4", stepIndex: 3, totalSteps: 4, title: "Verify implementation", description: "", status: "active" } satisfies StepData,
    }));

    t += 800;
    this.schedule(t, () => this.emit({
      type: "step",
      sessionId: sid,
      timestamp: Date.now(),
      data: { stepId: "s4", stepIndex: 3, totalSteps: 4, title: "Verify implementation", description: "", status: "complete" } satisfies StepData,
    }));

    // 7. Final response (streamed)
    const responseText = `I've made the following changes to your project:\n\n**Modified \`src/App.tsx\`:**\n- Added \`ThemeProvider\` wrapper with dark theme default\n- Added \`Toaster\` component for notification support\n- Preserved existing routing structure\n\n**Verified:**\n- Build completes successfully (42 modules, 1.23s)\n- No TypeScript errors\n- All existing functionality preserved\n\nThe theme provider is now available throughout the app. You can toggle themes using the \`useTheme()\` hook from any component.`;

    const words = responseText.split(" ");
    const chunkSize = 4;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ") + " ";
      const isLast = i + chunkSize >= words.length;
      t += 60;
      this.schedule(t, () => this.emit({
        type: "stream_delta",
        sessionId: sid,
        timestamp: Date.now(),
        data: { content: chunk, isComplete: isLast } satisfies StreamDeltaData,
      }));
    }

    // 8. Final message
    t += 200;
    this.schedule(t, () => {
      this.emit({
        type: "message",
        sessionId: sid,
        timestamp: Date.now(),
        data: { content: responseText, role: "assistant", isComplete: true } satisfies MessageData,
      });

      if (this._session) this._session.status = "idle";
    });
  }

  // ─── Utility ─────────────────────────────────────────────────────

  isConnected(): boolean {
    return this._status.running;
  }
}

// Singleton instance
export const hermesBridge = new HermesBridge();

// ─── React Hook ──────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";

export function useHermesBridge() {
  const [status, setStatus] = useState<HermesStatus>(hermesBridge.status);
  const [connected, setConnected] = useState(hermesBridge.isConnected());

  useEffect(() => {
    const unsub1 = hermesBridge.on("connected", () => {
      setStatus(hermesBridge.status);
      setConnected(true);
    });
    const unsub2 = hermesBridge.on("disconnected", () => {
      setStatus(hermesBridge.status);
      setConnected(false);
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  const start = useCallback(async (config: HermesConfig) => {
    await hermesBridge.start(config);
  }, []);

  const stop = useCallback(async () => {
    await hermesBridge.stop();
  }, []);

  const prompt = useCallback(async (content: string) => {
    await hermesBridge.prompt(content);
  }, []);

  return { status, connected, start, stop, prompt, bridge: hermesBridge };
}
