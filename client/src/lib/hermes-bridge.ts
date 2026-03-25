/*
 * Obsidian Forge — Hermes Agent Bridge
 * 
 * This module defines the bridge protocol for communicating with Hermes Agent.
 * In the Tauri desktop build, this would use Tauri commands (Rust) to spawn/manage
 * the Hermes process. In the web prototype, it simulates the protocol with demo data.
 * 
 * Protocol Design:
 * - Hermes is spawned as a child process by the Tauri sidecar
 * - Communication uses JSON-RPC 2.0 over stdin/stdout (matching Hermes RPC mode)
 * - Events are streamed as newline-delimited JSON (NDJSON)
 * - The bridge exposes a stable event emitter interface to the React UI
 * 
 * Tauri Command Signatures (for future Rust implementation):
 *   #[tauri::command] fn hermes_start(config: HermesConfig) -> Result<(), String>
 *   #[tauri::command] fn hermes_stop() -> Result<(), String>
 *   #[tauri::command] fn hermes_send(message: String) -> Result<(), String>
 *   #[tauri::command] fn hermes_status() -> Result<HermesStatus, String>
 */

// ─── Event Types ─────────────────────────────────────────────────────

export type HermesEventType =
  | "connected"
  | "disconnected"
  | "thinking"
  | "plan_created"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "tool_call"
  | "tool_result"
  | "approval_required"
  | "message"
  | "error"
  | "stream_token";

export interface HermesEvent {
  type: HermesEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

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
}

// ─── JSON-RPC Protocol ───────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// ─── Bridge Class ────────────────────────────────────────────────────

type EventHandler = (event: HermesEvent) => void;

export class HermesBridge {
  private listeners: Map<HermesEventType | "*", Set<EventHandler>> = new Map();
  private _status: HermesStatus = { running: false };
  private _config: HermesConfig | null = null;
  private messageId = 0;
  private simulationTimer: ReturnType<typeof setTimeout> | null = null;

  get status(): HermesStatus {
    return this._status;
  }

  // ─── Event Emitter ───────────────────────────────────────────────

  on(event: HermesEventType | "*", handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit(event: HermesEvent): void {
    this.listeners.get(event.type)?.forEach((h) => h(event));
    this.listeners.get("*")?.forEach((h) => h(event));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  async start(config: HermesConfig): Promise<void> {
    this._config = config;

    // In Tauri: invoke("hermes_start", { config })
    // In web prototype: simulate connection
    this._status = {
      running: true,
      pid: 12345,
      uptime: 0,
      model: "hermes-3-llama-3.1-70b",
      sessionId: crypto.randomUUID(),
    };

    this.emit({
      type: "connected",
      timestamp: Date.now(),
      data: { status: this._status },
    });
  }

  async stop(): Promise<void> {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = null;
    }

    this._status = { running: false };

    this.emit({
      type: "disconnected",
      timestamp: Date.now(),
      data: { reason: "user_stopped" },
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    if (this._config) {
      await this.start(this._config);
    }
  }

  // ─── Messaging ───────────────────────────────────────────────────

  async sendMessage(content: string): Promise<void> {
    if (!this._status.running) {
      throw new Error("Hermes is not running");
    }

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: String(++this.messageId),
      method: "chat",
      params: { content },
    };

    // In Tauri: invoke("hermes_send", { message: JSON.stringify(request) })
    // In web prototype: simulate response flow
    this.simulateAgentResponse(content);
  }

  async approveAction(approvalId: string, approved: boolean, alwaysAllow: boolean): Promise<void> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: String(++this.messageId),
      method: "approve",
      params: { approvalId, approved, alwaysAllow },
    };

    // In Tauri: invoke("hermes_send", { message: JSON.stringify(request) })
    this.emit({
      type: approved ? "step_completed" : "step_failed",
      timestamp: Date.now(),
      data: { approvalId, approved, alwaysAllow },
    });
  }

  // ─── Simulation (Web Prototype) ──────────────────────────────────

  private simulateAgentResponse(userMessage: string): void {
    const steps = [
      { delay: 500, type: "thinking" as const, data: {} },
      {
        delay: 1500,
        type: "plan_created" as const,
        data: {
          plan: [
            { id: "s1", title: "Analyze request", description: "Understanding the user's intent" },
            { id: "s2", title: "Read relevant files", description: "Scanning codebase for context" },
            { id: "s3", title: "Implement changes", description: "Writing code modifications" },
            { id: "s4", title: "Verify changes", description: "Running tests and validation" },
          ],
        },
      },
      { delay: 2500, type: "step_started" as const, data: { stepId: "s1" } },
      {
        delay: 4000,
        type: "tool_call" as const,
        data: { tool: "read_file", args: { path: "/src/App.tsx" } },
      },
      { delay: 5000, type: "step_completed" as const, data: { stepId: "s1" } },
      { delay: 5500, type: "step_started" as const, data: { stepId: "s2" } },
      {
        delay: 7000,
        type: "message" as const,
        data: {
          role: "assistant",
          content: `I've analyzed the codebase and understand the structure. Let me implement the changes you requested regarding "${userMessage.slice(0, 50)}..."`,
        },
      },
    ];

    steps.forEach(({ delay, type, data }) => {
      this.simulationTimer = setTimeout(() => {
        this.emit({ type, timestamp: Date.now(), data });
      }, delay);
    });
  }

  // ─── Utility ─────────────────────────────────────────────────────

  getSessionLog(): string {
    // In Tauri: invoke("hermes_get_log")
    return "Session log would be captured from Hermes stdout/stderr";
  }

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

  const sendMessage = useCallback(async (content: string) => {
    await hermesBridge.sendMessage(content);
  }, []);

  return { status, connected, start, stop, sendMessage, bridge: hermesBridge };
}
