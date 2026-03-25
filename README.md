# Dream IDE

A custom desktop IDE built with **Tauri 2 + React + TypeScript**, designed for task-oriented AI agent workflows. Inspired by Cursor's UX but built around transparency, safety, and open-weight model support via **Hermes Agent** (Nous Research).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Tauri 2 Shell (Rust)                                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  React Frontend                                   │  │
│  │  ┌──────────┬──────────────┬──────────────────┐  │  │
│  │  │ File     │ Monaco       │ Agent Panel      │  │  │
│  │  │ Tree     │ Editor       │ Chat Thread      │  │  │
│  │  │          │ + Diff View  │ Approvals Queue  │  │  │
│  │  │          ├──────────────┤ Settings         │  │  │
│  │  │          │ Terminal     │                   │  │  │
│  │  │          │ (xterm.js)   │                   │  │  │
│  │  └──────────┴──────────────┴──────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Hermes Agent Bridge (JSON-RPC over stdio)        │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────────────┐ │  │
│  │  │ Hermes  │ │ Tabby    │ │ MCP Servers         │ │  │
│  │  │ Sidecar │ │ Sidecar  │ │ (stdio/HTTP/SSE)   │ │  │
│  │  └─────────┘ └──────────┘ └────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Features

### Core IDE
- **Monaco Editor** with syntax highlighting, diff view, and tab management
- **File Tree** with collapsible directories and file type icons
- **Integrated Terminal** (xterm.js) with multi-session support
- **Command Palette** (Ctrl+K) with fuzzy search
- **Three-column resizable layout** (file tree | editor+terminal | right panel)

### AI Agent Integration
- **Hermes Agent Bridge** — JSON-RPC protocol for agent communication
- **Step Timeline** — Visual plan/steps/tool calls with status tracking
- **Chat Thread** — Markdown rendering, tool call inline cards
- **Approval Queue** — Allow once / Always allow / Deny for risky operations
- **Agent Memory** — Cross-session context persistence (like .cursorrules)

### Model & Tool Ecosystem
- **Multi-Model Support** — Nous/Hermes, OpenAI, Anthropic, Google, Groq, OpenRouter, local models via LiteLLM proxy
- **MCP Client** — Model Context Protocol support with server management UI
- **Tab Autocomplete** — Tabby-compatible inline completion engine for Monaco
- **LSP Bridge** — Language Server Protocol integration (TypeScript, Python, Rust, Go)
- **Codebase Indexing** — Trigram-based file/symbol/content search with semantic ranking

### Safety
- **No silent rm** — Dangerous commands blocked by default
- **Concurrent tool caps** — Configurable limit on parallel tool executions
- **Secret redaction** — API keys, tokens, passwords auto-redacted in logs
- **Crash recovery** — Reconnect to Hermes, resume UI state best-effort

## Design: Obsidian Forge

Dark industrial aesthetic with:
- **Color**: Deep charcoal (#0D0F12) base, warm amber (#E8A838) accent, muted teal for success
- **Typography**: JetBrains Mono (headers/code) + IBM Plex Sans (body/UI)
- **Signature**: Forge Pulse (amber glow during agent work), Step Ticker timeline, Approval Stamp cards

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Tauri 2 (Rust) — web prototype runs standalone |
| Frontend | React 19 + TypeScript + Tailwind CSS 4 |
| Editor | Monaco Editor |
| Terminal | xterm.js |
| State | Zustand + Immer |
| Layout | react-resizable-panels |
| Agent | Hermes (Nous Research) via JSON-RPC |
| Autocomplete | Tabby (self-hosted) |
| MCP | @modelcontextprotocol/sdk |
| Models | LiteLLM proxy for multi-provider |

## Getting Started

### Web Prototype (current)

```bash
pnpm install
pnpm dev
```

### Desktop Build (Tauri 2)

```bash
# Install Tauri CLI
cargo install tauri-cli

# Initialize Tauri in the project
cargo tauri init

# Copy Rust command stubs from client/src/lib/tauri-commands.ts
# into src-tauri/src/hermes.rs

# Build
cargo tauri build
```

## Project Structure

```
client/
  src/
    components/
      FileTree.tsx          # Workspace file tree
      CodeEditor.tsx        # Monaco editor with diff view
      AgentPanel.tsx        # Agent run panel with step timeline
      ChatThread.tsx        # Chat conversation thread
      ApprovalsQueue.tsx    # Safety approval cards
      SettingsPanel.tsx     # Tabbed settings (Agent/Models/MCP/Safety/Editor/Memory)
      Terminal.tsx           # xterm.js integrated terminal
      CommandPalette.tsx    # Ctrl+K command palette
      MCPManager.tsx        # MCP server management UI
      ModelSelector.tsx     # Multi-model provider selector
    lib/
      store.ts              # Zustand global state
      hermes-bridge.ts      # Hermes Agent JSON-RPC bridge
      tauri-commands.ts     # Tauri command stubs (Rust outlines)
      safety.ts             # Secret redaction, command validation
      mcp-client.ts         # MCP client manager
      litellm-proxy.ts      # Multi-model provider config
      tab-autocomplete.ts   # Tabby inline completion engine
      lsp-bridge.ts         # LSP integration for Monaco
      codebase-index.ts     # File/symbol/content search
      agent-memory.ts       # Cross-session agent memory
      sandbox-exec.ts       # Sandboxed command execution
      demo-data.ts          # Demo data for prototype
    pages/
      Home.tsx              # Project picker
      Workspace.tsx         # Main IDE workspace
```

## Roadmap

- [ ] Wire real Hermes Agent communication (replace simulation)
- [ ] Add Tauri 2 Rust backend with PTY terminal
- [ ] Implement real LSP connections per language
- [ ] Add Git integration (blame, history, diffs)
- [ ] Add VS Code extension compatibility layer
- [ ] Add Composer-style multi-file edit mode
- [ ] Add BugBot-style PR review

## License

MIT
