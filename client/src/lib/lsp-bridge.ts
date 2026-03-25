/*
 * Obsidian Forge — LSP Bridge
 *
 * Bridges Language Server Protocol servers to Monaco editor for
 * diagnostics, go-to-definition, hover, completions, and more.
 *
 * Integration path:
 *   Repo: https://github.com/TypeFox/monaco-languageclient (1.5k stars)
 *   In Tauri: spawn language servers as child processes, communicate via JSON-RPC over stdio
 *   In web: simulate basic diagnostics and hover
 *
 * Architecture:
 *   Monaco Editor → LSPBridge → Tauri Command → Language Server Process (stdio)
 *   Each language has its own server process managed by the bridge.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface LSPServerConfig {
  languageId: string;
  serverName: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  installCommand?: string;
  description: string;
}

export type LSPServerStatus = "stopped" | "starting" | "running" | "error";

export interface LSPServerState {
  config: LSPServerConfig;
  status: LSPServerStatus;
  capabilities: string[];
  error?: string;
}

export interface Diagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  source: string;
  code?: string;
}

export interface HoverInfo {
  contents: string;
  range?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

export interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  insertText: string;
  sortText?: string;
}

export interface DefinitionLocation {
  uri: string;
  line: number;
  column: number;
}

// ─── Known Language Servers ─────────────────────────────────────────

export const KNOWN_LANGUAGE_SERVERS: LSPServerConfig[] = [
  {
    languageId: "typescript",
    serverName: "TypeScript Language Server",
    command: "typescript-language-server",
    args: ["--stdio"],
    fileExtensions: [".ts", ".tsx", ".js", ".jsx"],
    installCommand: "npm install -g typescript-language-server typescript",
    description: "Full TypeScript/JavaScript support with type checking, completions, and refactoring",
  },
  {
    languageId: "python",
    serverName: "Pyright",
    command: "pyright-langserver",
    args: ["--stdio"],
    fileExtensions: [".py"],
    installCommand: "pip install pyright",
    description: "Fast Python type checker and language server",
  },
  {
    languageId: "rust",
    serverName: "rust-analyzer",
    command: "rust-analyzer",
    args: [],
    fileExtensions: [".rs"],
    installCommand: "rustup component add rust-analyzer",
    description: "Rust language support with cargo integration",
  },
  {
    languageId: "go",
    serverName: "gopls",
    command: "gopls",
    args: ["serve"],
    fileExtensions: [".go"],
    installCommand: "go install golang.org/x/tools/gopls@latest",
    description: "Official Go language server",
  },
  {
    languageId: "css",
    serverName: "CSS Language Server",
    command: "css-languageserver",
    args: ["--stdio"],
    fileExtensions: [".css", ".scss", ".less"],
    installCommand: "npm install -g vscode-css-languageserver-bin",
    description: "CSS, SCSS, and Less support",
  },
  {
    languageId: "html",
    serverName: "HTML Language Server",
    command: "html-languageserver",
    args: ["--stdio"],
    fileExtensions: [".html", ".htm"],
    installCommand: "npm install -g vscode-html-languageserver-bin",
    description: "HTML support with Emmet",
  },
  {
    languageId: "json",
    serverName: "JSON Language Server",
    command: "vscode-json-languageserver",
    args: ["--stdio"],
    fileExtensions: [".json", ".jsonc"],
    installCommand: "npm install -g vscode-json-languageserver",
    description: "JSON with schema validation",
  },
];

// ─── LSP Bridge ─────────────────────────────────────────────────────

type LSPStateChangeHandler = (servers: LSPServerState[]) => void;

export class LSPBridge {
  private servers: Map<string, LSPServerState> = new Map();
  private listeners: Set<LSPStateChangeHandler> = new Set();

  onStateChange(handler: LSPStateChangeHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private notify(): void {
    const states = this.getAllServerStates();
    this.listeners.forEach((h) => h(states));
  }

  getAllServerStates(): LSPServerState[] {
    return Array.from(this.servers.values());
  }

  // ─── Server Lifecycle ─────────────────────────────────────────────

  async startServer(config: LSPServerConfig): Promise<void> {
    this.servers.set(config.languageId, {
      config,
      status: "starting",
      capabilities: [],
    });
    this.notify();

    // In Tauri: invoke("lsp_start_server", { config })
    // In web prototype: simulate
    await new Promise((r) => setTimeout(r, 500));

    this.servers.set(config.languageId, {
      config,
      status: "running",
      capabilities: [
        "textDocument/completion",
        "textDocument/hover",
        "textDocument/definition",
        "textDocument/references",
        "textDocument/diagnostics",
        "textDocument/formatting",
        "textDocument/rename",
        "textDocument/signatureHelp",
      ],
    });
    this.notify();
  }

  async stopServer(languageId: string): Promise<void> {
    const server = this.servers.get(languageId);
    if (server) {
      this.servers.set(languageId, { ...server, status: "stopped", capabilities: [] });
      this.notify();
    }
  }

  // ─── LSP Operations (Simulated for Web) ───────────────────────────

  async getDiagnostics(uri: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    // Simple simulated diagnostics
    lines.forEach((line, i) => {
      // Detect unused variables (very basic)
      const unusedMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
      if (unusedMatch && !content.includes(unusedMatch[1] + "(") && !content.includes(unusedMatch[1] + ".")) {
        // Only flag if variable appears exactly once
        const count = (content.match(new RegExp(`\\b${unusedMatch[1]}\\b`, "g")) || []).length;
        if (count === 1) {
          diagnostics.push({
            line: i + 1,
            column: line.indexOf(unusedMatch[1]) + 1,
            endLine: i + 1,
            endColumn: line.indexOf(unusedMatch[1]) + unusedMatch[1].length + 1,
            message: `'${unusedMatch[1]}' is declared but its value is never read.`,
            severity: "warning",
            source: "ts",
            code: "6133",
          });
        }
      }

      // Detect console.log (lint warning)
      if (line.includes("console.log")) {
        diagnostics.push({
          line: i + 1,
          column: line.indexOf("console.log") + 1,
          endLine: i + 1,
          endColumn: line.indexOf("console.log") + 12,
          message: "Unexpected console statement.",
          severity: "warning",
          source: "eslint",
          code: "no-console",
        });
      }

      // Detect TODO comments
      const todoMatch = line.match(/\/\/\s*TODO/i);
      if (todoMatch) {
        diagnostics.push({
          line: i + 1,
          column: (todoMatch.index || 0) + 1,
          endLine: i + 1,
          endColumn: line.length + 1,
          message: line.slice((todoMatch.index || 0) + 2).trim(),
          severity: "info",
          source: "todo",
        });
      }
    });

    return diagnostics;
  }

  async getHover(uri: string, line: number, column: number, content: string): Promise<HoverInfo | null> {
    // Simulate hover info
    const lines = content.split("\n");
    const lineText = lines[line - 1] || "";

    // Find word at position
    const wordMatch = lineText.slice(0, column).match(/\w+$/);
    const word = wordMatch ? wordMatch[0] + (lineText.slice(column - 1).match(/^\w+/)?.[0] || "") : null;

    if (!word) return null;

    // Known type hovers
    const knownTypes: Record<string, string> = {
      useState: "```typescript\nfunction useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>]\n```\nReturns a stateful value, and a function to update it.",
      useEffect: "```typescript\nfunction useEffect(effect: EffectCallback, deps?: DependencyList): void\n```\nAccepts a function that contains imperative, possibly effectful code.",
      useCallback: "```typescript\nfunction useCallback<T extends Function>(callback: T, deps: DependencyList): T\n```\nReturns a memoized callback.",
      useMemo: "```typescript\nfunction useMemo<T>(factory: () => T, deps: DependencyList): T\n```\nReturns a memoized value.",
      console: "```typescript\nvar console: Console\n```\nThe console module provides a simple debugging console.",
      Promise: "```typescript\ninterface Promise<T>\n```\nRepresents the eventual completion (or failure) of an asynchronous operation.",
      Map: "```typescript\ninterface Map<K, V>\n```\nA collection of key-value pairs with unique keys.",
      Set: "```typescript\ninterface Set<T>\n```\nA collection of unique values.",
      Array: "```typescript\ninterface Array<T>\n```\nRepresents an ordered list of values.",
    };

    if (knownTypes[word]) {
      return { contents: knownTypes[word] };
    }

    return null;
  }

  async getCompletions(uri: string, line: number, column: number, content: string): Promise<CompletionItem[]> {
    // Basic simulated completions
    return [
      { label: "console.log", kind: "Method", detail: "Log to console", insertText: "console.log($1)", sortText: "0" },
      { label: "console.error", kind: "Method", detail: "Log error to console", insertText: "console.error($1)", sortText: "1" },
      { label: "JSON.stringify", kind: "Method", detail: "Convert to JSON string", insertText: "JSON.stringify($1)", sortText: "2" },
      { label: "JSON.parse", kind: "Method", detail: "Parse JSON string", insertText: "JSON.parse($1)", sortText: "3" },
    ];
  }

  async getDefinition(uri: string, line: number, column: number): Promise<DefinitionLocation | null> {
    // In Tauri: invoke("lsp_goto_definition", { uri, line, column })
    return null;
  }

  // ─── Auto-detect and start servers for open files ─────────────────

  getServerForFile(filePath: string): LSPServerConfig | undefined {
    const ext = "." + filePath.split(".").pop();
    return KNOWN_LANGUAGE_SERVERS.find((s) => s.fileExtensions.includes(ext));
  }

  async ensureServerForFile(filePath: string): Promise<void> {
    const config = this.getServerForFile(filePath);
    if (!config) return;

    const existing = this.servers.get(config.languageId);
    if (existing && existing.status === "running") return;

    await this.startServer(config);
  }
}

// Singleton
export const lspBridge = new LSPBridge();

// ─── React Hook ─────────────────────────────────────────────────────

import { useState, useEffect } from "react";

export function useLSPServers() {
  const [servers, setServers] = useState<LSPServerState[]>(lspBridge.getAllServerStates());

  useEffect(() => {
    const unsub = lspBridge.onStateChange(setServers);
    return unsub;
  }, []);

  return { servers, bridge: lspBridge };
}
