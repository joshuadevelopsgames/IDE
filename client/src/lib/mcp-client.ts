/*
 * Obsidian Forge — MCP (Model Context Protocol) Client
 *
 * Implements an MCP client that can connect to any MCP server,
 * discover tools/resources, and call them on behalf of the agent.
 *
 * In the Tauri desktop build, MCP servers are spawned as child processes
 * via stdio transport. In the web prototype, we simulate the protocol.
 *
 * Integration path:
 *   npm: @modelcontextprotocol/sdk (official SDK from Anthropic)
 *   Repo: https://github.com/modelcontextprotocol/typescript-sdk (11.9k stars)
 *
 * Architecture:
 *   HermesBridge → MCPClientManager → [MCPServerConnection, MCPServerConnection, ...]
 *   Each connection manages one MCP server process and exposes its tools.
 */

// ─── MCP Protocol Types ─────────────────────────────────────────────

export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;        // for stdio: e.g. "npx @playwright/mcp"
  args?: string[];         // for stdio: command arguments
  url?: string;            // for sse/http: server URL
  env?: Record<string, string>;
  enabled: boolean;
  autoStart: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPToolCallResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export type MCPServerStatus = "disconnected" | "connecting" | "connected" | "error";

export interface MCPServerState {
  config: MCPServerConfig;
  status: MCPServerStatus;
  tools: MCPTool[];
  resources: MCPResource[];
  error?: string;
  lastConnected?: number;
}

// ─── MCP Server Connection ──────────────────────────────────────────

class MCPServerConnection {
  private _state: MCPServerState;
  private _onStateChange: (state: MCPServerState) => void;

  constructor(config: MCPServerConfig, onStateChange: (state: MCPServerState) => void) {
    this._state = {
      config,
      status: "disconnected",
      tools: [],
      resources: [],
    };
    this._onStateChange = onStateChange;
  }

  get state(): MCPServerState {
    return this._state;
  }

  async connect(): Promise<void> {
    this.updateState({ status: "connecting" });

    try {
      // In Tauri: spawn child process via Tauri command
      // invoke("mcp_server_start", { config: this._state.config })
      //
      // In web prototype: simulate connection
      await this.simulateConnection();
    } catch (err) {
      this.updateState({
        status: "error",
        error: err instanceof Error ? err.message : "Connection failed",
      });
    }
  }

  async disconnect(): Promise<void> {
    // In Tauri: invoke("mcp_server_stop", { serverId: this._state.config.id })
    this.updateState({ status: "disconnected", tools: [], resources: [] });
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (this._state.status !== "connected") {
      throw new Error(`MCP server ${this._state.config.name} is not connected`);
    }

    // In Tauri: invoke("mcp_call_tool", { serverId, toolName, args })
    // In web prototype: simulate
    return this.simulateToolCall(toolName, args);
  }

  async listTools(): Promise<MCPTool[]> {
    return this._state.tools;
  }

  async listResources(): Promise<MCPResource[]> {
    return this._state.resources;
  }

  private updateState(partial: Partial<MCPServerState>): void {
    this._state = { ...this._state, ...partial };
    this._onStateChange(this._state);
  }

  // ─── Simulation (Web Prototype) ──────────────────────────────────

  private async simulateConnection(): Promise<void> {
    await new Promise((r) => setTimeout(r, 800));

    const tools = this.getSimulatedTools();
    const resources = this.getSimulatedResources();

    this.updateState({
      status: "connected",
      tools,
      resources,
      lastConnected: Date.now(),
    });
  }

  private getSimulatedTools(): MCPTool[] {
    const id = this._state.config.id;
    const base: MCPTool[] = [];

    if (this._state.config.name.toLowerCase().includes("filesystem")) {
      base.push(
        { name: "read_file", description: "Read contents of a file", inputSchema: { type: "object", properties: { path: { type: "string" } } }, serverId: id },
        { name: "write_file", description: "Write contents to a file", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } }, serverId: id },
        { name: "list_directory", description: "List directory contents", inputSchema: { type: "object", properties: { path: { type: "string" } } }, serverId: id },
      );
    } else if (this._state.config.name.toLowerCase().includes("github")) {
      base.push(
        { name: "create_issue", description: "Create a GitHub issue", inputSchema: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } } }, serverId: id },
        { name: "create_pr", description: "Create a pull request", inputSchema: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, head: { type: "string" }, base: { type: "string" } } }, serverId: id },
        { name: "search_repos", description: "Search GitHub repositories", inputSchema: { type: "object", properties: { query: { type: "string" } } }, serverId: id },
      );
    } else if (this._state.config.name.toLowerCase().includes("playwright")) {
      base.push(
        { name: "navigate", description: "Navigate browser to URL", inputSchema: { type: "object", properties: { url: { type: "string" } } }, serverId: id },
        { name: "screenshot", description: "Take a screenshot", inputSchema: { type: "object", properties: { selector: { type: "string" } } }, serverId: id },
        { name: "click", description: "Click an element", inputSchema: { type: "object", properties: { selector: { type: "string" } } }, serverId: id },
      );
    } else {
      base.push(
        { name: "echo", description: "Echo back the input", inputSchema: { type: "object", properties: { message: { type: "string" } } }, serverId: id },
      );
    }

    return base;
  }

  private getSimulatedResources(): MCPResource[] {
    return [];
  }

  private async simulateToolCall(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    await new Promise((r) => setTimeout(r, 500));
    return {
      content: [{
        type: "text",
        text: `[Simulated] Tool "${toolName}" called with args: ${JSON.stringify(args)}`,
      }],
    };
  }
}

// ─── MCP Client Manager ─────────────────────────────────────────────

type MCPStateChangeHandler = (servers: MCPServerState[]) => void;

export class MCPClientManager {
  private connections: Map<string, MCPServerConnection> = new Map();
  private listeners: Set<MCPStateChangeHandler> = new Set();

  // ─── Default server configs (curated list) ────────────────────────

  static readonly DEFAULT_SERVERS: MCPServerConfig[] = [
    {
      id: "filesystem",
      name: "Filesystem",
      description: "Read, write, and manage local files",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      enabled: true,
      autoStart: true,
    },
    {
      id: "github",
      name: "GitHub",
      description: "Interact with GitHub repos, issues, and PRs",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
      enabled: false,
      autoStart: false,
    },
    {
      id: "playwright",
      name: "Playwright Browser",
      description: "Automate browser interactions for testing and scraping",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
      enabled: false,
      autoStart: false,
    },
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────

  onStateChange(handler: MCPStateChangeHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private notifyListeners(): void {
    const states = this.getAllServerStates();
    this.listeners.forEach((h) => h(states));
  }

  async addServer(config: MCPServerConfig): Promise<void> {
    const conn = new MCPServerConnection(config, () => this.notifyListeners());
    this.connections.set(config.id, conn);

    if (config.enabled && config.autoStart) {
      await conn.connect();
    }

    this.notifyListeners();
  }

  async removeServer(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (conn) {
      await conn.disconnect();
      this.connections.delete(serverId);
      this.notifyListeners();
    }
  }

  async connectServer(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (conn) await conn.connect();
  }

  async disconnectServer(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (conn) await conn.disconnect();
  }

  // ─── Tool Discovery & Execution ──────────────────────────────────

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const conn of Array.from(this.connections.values())) {
      if (conn.state.status === "connected") {
        tools.push(...conn.state.tools);
      }
    }
    return tools;
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const conn = this.connections.get(serverId);
    if (!conn) throw new Error(`MCP server ${serverId} not found`);
    return conn.callTool(toolName, args);
  }

  getAllServerStates(): MCPServerState[] {
    return Array.from(this.connections.values()).map((c) => c.state);
  }

  getServerState(serverId: string): MCPServerState | undefined {
    return this.connections.get(serverId)?.state;
  }

  // ─── Initialization ──────────────────────────────────────────────

  async initializeDefaults(): Promise<void> {
    for (const config of MCPClientManager.DEFAULT_SERVERS) {
      await this.addServer(config);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const conn of Array.from(this.connections.values())) {
      await conn.disconnect();
    }
  }
}

// Singleton
export const mcpManager = new MCPClientManager();

// ─── React Hook ─────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

export function useMCPServers() {
  const [servers, setServers] = useState<MCPServerState[]>(mcpManager.getAllServerStates());

  useEffect(() => {
    const unsub = mcpManager.onStateChange(setServers);
    return unsub;
  }, []);

  const addServer = useCallback(async (config: MCPServerConfig) => {
    await mcpManager.addServer(config);
  }, []);

  const removeServer = useCallback(async (serverId: string) => {
    await mcpManager.removeServer(serverId);
  }, []);

  const connectServer = useCallback(async (serverId: string) => {
    await mcpManager.connectServer(serverId);
  }, []);

  const disconnectServer = useCallback(async (serverId: string) => {
    await mcpManager.disconnectServer(serverId);
  }, []);

  const allTools = mcpManager.getAllTools();

  return { servers, allTools, addServer, removeServer, connectServer, disconnectServer };
}
