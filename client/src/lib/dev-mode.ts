/*
 * Obsidian Forge — IDE Dev Mode
 *
 * "Meta-development" mode: use the IDE's own AI agent to develop the IDE itself.
 * When active, the agent receives rich context about Dream IDE's architecture,
 * component structure, design system, and conventions — so it can intelligently
 * modify its own codebase.
 *
 * This module provides:
 *   1. Architecture map — component tree, module responsibilities, data flow
 *   2. Design system context — Obsidian Forge tokens, typography, spacing rules
 *   3. Convention rules — coding patterns, file organization, naming conventions
 *   4. Self-development system prompt — injected into Hermes when Dev Mode is active
 *   5. Dev Mode state management
 */

// ─── Architecture Map ──────────────────────────────────────────────

export interface ArchitectureNode {
  name: string;
  path: string;
  type: "component" | "module" | "page" | "hook" | "context" | "config" | "style";
  description: string;
  dependencies: string[];
  exports: string[];
  tags: string[];
}

export const ARCHITECTURE_MAP: ArchitectureNode[] = [
  // Pages
  {
    name: "Home",
    path: "client/src/pages/Home.tsx",
    type: "page",
    description: "Project picker / landing page. Hero with forge background, recent projects grid, open folder action. Seeds workspace with demo file tree on project open.",
    dependencies: ["store", "demo-data"],
    exports: ["Home"],
    tags: ["entry", "navigation"],
  },
  {
    name: "Workspace",
    path: "client/src/pages/Workspace.tsx",
    type: "page",
    description: "Main IDE workspace. Three-column layout: file tree | editor+terminal | right panel (agent/approvals/settings). Contains TitleBar, ActivityBar, StatusBar sub-components.",
    dependencies: ["FileTree", "CodeEditor", "ChatThread", "ApprovalsQueue", "SettingsPanel", "CommandPalette", "Terminal", "store"],
    exports: ["Workspace"],
    tags: ["layout", "core"],
  },

  // Core Components
  {
    name: "ChatThread",
    path: "client/src/components/ChatThread.tsx",
    type: "component",
    description: "Unified run view (Cursor-style). Renders structured output blocks: thinking, steps, file diffs, terminal output, search results, approvals, streaming response. Listens to ACP events from hermes-bridge.",
    dependencies: ["store", "hermes-bridge", "streamdown"],
    exports: ["ChatThread"],
    tags: ["agent", "chat", "core"],
  },
  {
    name: "CodeEditor",
    path: "client/src/components/CodeEditor.tsx",
    type: "component",
    description: "Monaco editor with tab management, diff view toggle, syntax highlighting. Supports proposed edits as unified diffs before apply.",
    dependencies: ["store", "@monaco-editor/react"],
    exports: ["CodeEditor"],
    tags: ["editor", "core"],
  },
  {
    name: "FileTree",
    path: "client/src/components/FileTree.tsx",
    type: "component",
    description: "Collapsible directory tree with file type icons, context awareness. Opens files in editor tabs on click.",
    dependencies: ["store"],
    exports: ["FileTree"],
    tags: ["navigation", "core"],
  },
  {
    name: "Terminal",
    path: "client/src/components/Terminal.tsx",
    type: "component",
    description: "Integrated terminal using xterm.js. Multi-session tabs, resize support. Lazy-loaded.",
    dependencies: ["@xterm/xterm", "@xterm/addon-fit"],
    exports: ["Terminal"],
    tags: ["terminal", "core"],
  },
  {
    name: "ApprovalsQueue",
    path: "client/src/components/ApprovalsQueue.tsx",
    type: "component",
    description: "Dedicated approvals panel. Risk-level badges, Allow once / Always allow / Deny buttons. Reads from store's currentRun.approvals.",
    dependencies: ["store"],
    exports: ["ApprovalsQueue"],
    tags: ["safety", "approvals"],
  },
  {
    name: "SettingsPanel",
    path: "client/src/components/SettingsPanel.tsx",
    type: "component",
    description: "Tabbed settings: Agent, Models, MCP, Safety, Editor, Memory. Integrates MCPManager and ModelSelector sub-components.",
    dependencies: ["store", "MCPManager", "ModelSelector"],
    exports: ["SettingsPanel"],
    tags: ["settings", "config"],
  },
  {
    name: "CommandPalette",
    path: "client/src/components/CommandPalette.tsx",
    type: "component",
    description: "Ctrl+K overlay with fuzzy search across commands. Opens panels, toggles features.",
    dependencies: ["store"],
    exports: ["CommandPalette"],
    tags: ["navigation", "commands"],
  },
  {
    name: "MCPManager",
    path: "client/src/components/MCPManager.tsx",
    type: "component",
    description: "MCP server management UI. Add/remove/connect servers, view tools per server.",
    dependencies: ["mcp-client"],
    exports: ["MCPManager"],
    tags: ["mcp", "settings"],
  },
  {
    name: "ModelSelector",
    path: "client/src/components/ModelSelector.tsx",
    type: "component",
    description: "Model/provider selector. Shows all providers (Nous, OpenAI, Anthropic, etc.) with model cards and API key inputs.",
    dependencies: ["store", "litellm-proxy"],
    exports: ["ModelSelector"],
    tags: ["models", "settings"],
  },

  // Core Modules
  {
    name: "store",
    path: "client/src/lib/store.ts",
    type: "module",
    description: "Zustand + immer store. Central state: navigation, file tree, editor tabs, agent runs, approvals, projects, settings, UI toggles. All components read/write through this.",
    dependencies: ["zustand", "zustand/middleware/immer"],
    exports: ["useIDEStore", "FileNode", "EditorTab", "AgentStatus", "PlanStep", "ToolCall", "ChatMessage", "ApprovalRequest", "AgentRun", "ProjectInfo", "IDESettings", "ActiveView", "RightPanel"],
    tags: ["state", "core"],
  },
  {
    name: "hermes-bridge",
    path: "client/src/lib/hermes-bridge.ts",
    type: "module",
    description: "Hermes Agent bridge using ACP protocol (JSON-RPC 2.0 over stdio). Event emitter for thinking, reasoning, steps, tool calls, file diffs, terminal output, permissions, streaming. Web prototype simulates events; Tauri build uses real sidecar.",
    dependencies: [],
    exports: ["HermesBridge", "hermesBridge", "useHermesBridge", "ACPEvent", "ACPEventType", "ThinkingData", "StepData", "ToolCallStartData", "ToolProgressData", "ToolCallEndData", "StreamDeltaData", "PermissionRequestData"],
    tags: ["agent", "bridge", "core"],
  },
  {
    name: "mcp-client",
    path: "client/src/lib/mcp-client.ts",
    type: "module",
    description: "MCP (Model Context Protocol) client manager. Simulated server connections, tool discovery, tool invocation. Default servers: filesystem, github, playwright.",
    dependencies: [],
    exports: ["MCPClientManager", "mcpManager", "useMCPServers"],
    tags: ["mcp", "integrations"],
  },
  {
    name: "litellm-proxy",
    path: "client/src/lib/litellm-proxy.ts",
    type: "module",
    description: "Multi-model provider registry. Defines MODEL_PROVIDERS with metadata (context window, cost, capabilities). Generates LiteLLM sidecar config.",
    dependencies: [],
    exports: ["MODEL_PROVIDERS", "getProvider", "getModel", "generateLiteLLMConfig"],
    tags: ["models", "config"],
  },
  {
    name: "tab-autocomplete",
    path: "client/src/lib/tab-autocomplete.ts",
    type: "module",
    description: "Tab autocomplete engine. Tabby-compatible inline completion provider for Monaco. Debounced requests, ghost text rendering.",
    dependencies: [],
    exports: ["TabAutocompleteEngine", "tabAutocomplete"],
    tags: ["editor", "autocomplete"],
  },
  {
    name: "lsp-bridge",
    path: "client/src/lib/lsp-bridge.ts",
    type: "module",
    description: "LSP bridge for Monaco. Language server lifecycle management, diagnostics, hover, completion, go-to-definition.",
    dependencies: [],
    exports: ["LSPBridge", "lspBridge"],
    tags: ["editor", "lsp"],
  },
  {
    name: "codebase-index",
    path: "client/src/lib/codebase-index.ts",
    type: "module",
    description: "In-memory codebase indexing. Trigram-based fuzzy search, regex symbol extraction for TS/JS/Python/Rust.",
    dependencies: [],
    exports: ["CodebaseIndex", "codebaseIndex"],
    tags: ["search", "indexing"],
  },
  {
    name: "agent-memory",
    path: "client/src/lib/agent-memory.ts",
    type: "module",
    description: "Cross-session agent memory. localStorage persistence, weighted search, prompt-ready context blocks. .cursorrules-like instructions.",
    dependencies: [],
    exports: ["AgentMemoryStore", "agentMemory"],
    tags: ["memory", "context"],
  },
  {
    name: "safety",
    path: "client/src/lib/safety.ts",
    type: "module",
    description: "Safety guards. Secret redaction, dangerous command detection, concurrent tool caps, crash recovery state.",
    dependencies: [],
    exports: ["SafetyGuard", "safetyGuard"],
    tags: ["safety", "security"],
  },
  {
    name: "sandbox-exec",
    path: "client/src/lib/sandbox-exec.ts",
    type: "module",
    description: "Sandboxed terminal execution. Command validation, blocked commands, timeout/output limits. Local and E2B modes.",
    dependencies: [],
    exports: ["SandboxManager", "sandboxManager"],
    tags: ["terminal", "safety"],
  },
  {
    name: "tauri-commands",
    path: "client/src/lib/tauri-commands.ts",
    type: "module",
    description: "Tauri command stubs. TypeScript types + Rust implementation outlines for Hermes sidecar, filesystem, keychain, event listener.",
    dependencies: [],
    exports: ["tauriHermesStart", "tauriHermesStop", "tauriOpenFileDialog", "tauriReadFile", "tauriWriteFile"],
    tags: ["tauri", "desktop"],
  },
  {
    name: "demo-data",
    path: "client/src/lib/demo-data.ts",
    type: "module",
    description: "Demo/prototype data. Fake file tree, file contents, plan steps, messages, approvals for showcase.",
    dependencies: [],
    exports: ["DEMO_FILE_TREE", "DEMO_FILE_CONTENTS", "createDemoRun"],
    tags: ["demo", "prototype"],
  },
  {
    name: "dev-mode",
    path: "client/src/lib/dev-mode.ts",
    type: "module",
    description: "IDE Dev Mode. Self-development context, architecture map, design system rules, convention docs. Injects into agent context when active.",
    dependencies: ["agent-memory", "codebase-index"],
    exports: ["DevModeManager", "devModeManager", "ARCHITECTURE_MAP"],
    tags: ["dev-mode", "meta", "self-development"],
  },
];

// ─── Design System Context ─────────────────────────────────────────

export const DESIGN_SYSTEM_CONTEXT = `
## Dream IDE Design System — "Obsidian Forge"

### Color Tokens (OKLCH)
- Background: oklch(0.09 0.01 250) — #0D0F12 deep charcoal
- Surface: oklch(0.14 0.01 250) — #161A1F graphite panels
- Surface Raised: oklch(0.18 0.01 250) — #1E2228 elevated panels
- Surface Overlay: oklch(0.22 0.01 250) — #262B33 overlays/modals
- Gutter: oklch(0.11 0.01 250) — #131619 gutters/bars
- Forge Amber: oklch(0.78 0.16 70) — #E8A838 primary accent (agent activity, CTAs)
- Forge Teal: oklch(0.72 0.12 180) — #4ECDC4 success states
- Forge Coral: oklch(0.65 0.18 25) — #E85D4A danger/destructive
- Foreground: oklch(0.85 0.005 65) — warm white text
- Muted: oklch(0.55 0.01 250) — secondary text

### Typography
- Display/Headers: JetBrains Mono (monospace, technical feel)
- Body/UI: IBM Plex Sans (humanist, readable)
- Code: JetBrains Mono
- Font sizes: 10px (micro), 11px (caption), 12px (body-sm), 13px (body), 14px (body-lg)

### Spacing
- Micro: 2px, 4px (icon gaps)
- Small: 6px, 8px (padding)
- Medium: 12px, 16px (section gaps)
- Large: 24px, 32px (page sections)

### Component Patterns
- Panels: bg-card with border-border, rounded-lg for floating, sharp for docked
- Buttons: bg-forge-amber text-forge-gutter for primary, bg-forge-surface-raised for secondary
- Status indicators: Circle dot + label, animate-spin for loading, animate-pulse for waiting
- Activity bar items: 32x32px, 42px wide bar, left indicator line when active

### Animation Guidelines
- Transitions: 150ms for hover, 200ms for panel open/close
- Loading: Loader2 with animate-spin
- Pulse: animate-pulse for attention (amber glow)
- No spring/bounce — industrial feel, crisp transitions
`;

// ─── Convention Rules ──────────────────────────────────────────────

export const CONVENTION_RULES = `
## Dream IDE Coding Conventions

### File Organization
- Pages in client/src/pages/ (one per route)
- Reusable components in client/src/components/
- State/logic modules in client/src/lib/
- Each module has a header comment block explaining its purpose and integration path

### State Management
- Single Zustand store with immer middleware (client/src/lib/store.ts)
- All UI state flows through the store — components never hold cross-cutting state locally
- Types exported from store.ts are the canonical data model

### Component Patterns
- Function components only, no classes
- Destructure store hooks at top: const { x, y } = useIDEStore()
- Use cn() utility for conditional classNames (from @/lib/utils)
- Lucide icons only — import individually, never the whole package
- shadcn/ui for base components, extend don't replace

### Naming
- PascalCase for components and types
- camelCase for functions, variables, store actions
- UPPER_SNAKE_CASE for constants and architecture maps
- File names match default export: FileTree.tsx exports FileTree

### CSS / Styling
- Tailwind utility classes only — no custom CSS except index.css tokens
- Use forge-* custom colors defined in @theme inline block
- font-mono-code for monospace, font-sans for body (IBM Plex Sans)
- Text sizes as Tailwind classes: text-[10px], text-[11px], text-[12px], text-[13px]

### Agent Bridge
- All Hermes communication through hermes-bridge.ts singleton
- ACP events are the source of truth for agent state
- ChatThread listens to bridge events and renders blocks
- Store's agentStatus is updated by ChatThread based on events

### Safety
- All tool calls must go through safety.ts validation
- Dangerous commands (rm, chmod, etc.) require explicit approval
- Secrets are redacted in all logs and UI output
- Max concurrent tool runs enforced by store.settings.maxConcurrentTools
`;

// ─── Dev Mode System Prompt ────────────────────────────────────────

export function generateDevModeSystemPrompt(): string {
  const archSummary = ARCHITECTURE_MAP.map(
    (n) => `- **${n.name}** (${n.path}): ${n.description}`
  ).join("\n");

  return `
<system_context type="ide_dev_mode">
You are operating in **IDE Dev Mode** — you are developing Dream IDE itself.
Dream IDE is a Tauri 2 + React + TypeScript desktop IDE with an integrated AI agent (Hermes).

## Your Role
You are the AI assistant helping to develop and improve Dream IDE. You have full knowledge
of the codebase architecture, design system, and conventions. When making changes:
1. Follow the Obsidian Forge design system exactly
2. Maintain existing coding conventions
3. Update the architecture map if you add new modules
4. Test changes don't break existing functionality
5. Explain your reasoning for architectural decisions

## Architecture Map
${archSummary}

${DESIGN_SYSTEM_CONTEXT}

${CONVENTION_RULES}

## Key Integration Points
- To add a new panel: update RightPanel type in store.ts, add to ActivityBar in Workspace.tsx, add to RightPanelContent switch
- To add a new ACP event type: update ACPEventType in hermes-bridge.ts, add data interface, handle in ChatThread's event listener, add block renderer
- To add a new setting: update IDESettings in store.ts, add default value, add UI in SettingsPanel.tsx
- To add a new module: create in client/src/lib/, add to ARCHITECTURE_MAP in dev-mode.ts, document integration path

## Current Tech Stack
- React 19, TypeScript 5.6, Tailwind CSS 4, Vite 7
- Zustand + immer for state
- Monaco Editor for code editing
- xterm.js for terminal
- Framer Motion for animations
- shadcn/ui for base components
- Lucide for icons
- Streamdown for markdown rendering
</system_context>
`;
}

// ─── Dev Mode Quick Actions ────────────────────────────────────────

export interface DevModeAction {
  id: string;
  label: string;
  description: string;
  prompt: string;
  category: "feature" | "fix" | "refactor" | "design" | "docs";
}

export const DEV_MODE_QUICK_ACTIONS: DevModeAction[] = [
  {
    id: "add-git-ui",
    label: "Add Git integration",
    description: "Add inline git blame, history, and branch management UI",
    prompt: "Add a Git integration panel to Dream IDE. Include: inline blame annotations in the editor gutter, a git history view showing recent commits, and branch switching in the status bar. Follow the Obsidian Forge design system.",
    category: "feature",
  },
  {
    id: "add-search-panel",
    label: "Add workspace search",
    description: "Full-text search across all project files with regex support",
    prompt: "Add a workspace-wide search panel to Dream IDE. Include: full-text search with regex support, file filtering, result preview with line context, and click-to-open-in-editor. Add it as a new panel option in the activity bar.",
    category: "feature",
  },
  {
    id: "add-run-history",
    label: "Add run history",
    description: "Browse and replay past agent runs",
    prompt: "Add a run history feature to Dream IDE. Show a list of past agent runs with timestamps, titles, and status. Allow clicking a run to view its full block stream (thinking, diffs, terminal output). Store runs in the Zustand store and persist to localStorage.",
    category: "feature",
  },
  {
    id: "add-inline-actions",
    label: "Add inline diff actions",
    description: "Accept/Reject buttons on file diff cards",
    prompt: "Add Accept and Reject buttons to the FileDiffBlock component in ChatThread.tsx. Accept should apply the diff to the editor tab content. Reject should dismiss the diff. Show a subtle animation on accept/reject. Follow the Obsidian Forge design system.",
    category: "feature",
  },
  {
    id: "improve-file-tree",
    label: "Enhance file tree",
    description: "Add drag-drop, rename, delete, new file/folder actions",
    prompt: "Enhance the FileTree component with: right-click context menu (rename, delete, new file, new folder), drag-and-drop reordering, and inline rename editing. Use the existing Obsidian Forge styling.",
    category: "feature",
  },
  {
    id: "fix-panel-resize",
    label: "Fix panel resize persistence",
    description: "Remember panel sizes across sessions",
    prompt: "Fix panel resize persistence in Dream IDE. Save panel sizes to localStorage when the user resizes them, and restore on next session. Apply to: file tree width, right panel width, terminal height.",
    category: "fix",
  },
  {
    id: "refactor-store",
    label: "Split store into slices",
    description: "Refactor the monolithic store into domain slices",
    prompt: "Refactor the Zustand store in store.ts into domain-specific slices: editorSlice, agentSlice, projectSlice, settingsSlice, uiSlice. Use Zustand's slice pattern with immer. Keep all existing types and exports compatible.",
    category: "refactor",
  },
  {
    id: "add-animations",
    label: "Add micro-interactions",
    description: "Polish with entrance animations and hover effects",
    prompt: "Add micro-interactions to Dream IDE using Framer Motion: panel slide-in animations, block entrance animations in the chat thread, hover scale on activity bar icons, and a subtle forge pulse glow on the status bar when the agent is active. Keep it industrial and crisp — no bouncy springs.",
    category: "design",
  },
  {
    id: "add-keyboard-shortcuts",
    label: "Add keyboard shortcuts",
    description: "Comprehensive keyboard shortcut system",
    prompt: "Add a comprehensive keyboard shortcut system to Dream IDE. Include: Ctrl+1/2/3 for panel switching, Ctrl+B for file tree toggle, Ctrl+` for terminal, Ctrl+Shift+P for command palette, Ctrl+S for save, Ctrl+W for close tab. Show shortcuts in a help dialog (Ctrl+?).",
    category: "feature",
  },
  {
    id: "write-readme",
    label: "Generate README",
    description: "Write comprehensive project documentation",
    prompt: "Generate a comprehensive README.md for Dream IDE. Include: project overview, architecture diagram (Mermaid), feature list, tech stack, getting started guide, development workflow, design system reference, and contributing guidelines.",
    category: "docs",
  },
];

// ─── Dev Mode Manager ──────────────────────────────────────────────

export type DevModeTarget = "self" | "project";

export interface DevModeState {
  active: boolean;
  target: DevModeTarget;
  contextInjected: boolean;
  architectureExplorerOpen: boolean;
}

export class DevModeManager {
  private _state: DevModeState = {
    active: false,
    target: "project",
    contextInjected: false,
    architectureExplorerOpen: false,
  };

  get state(): DevModeState {
    return { ...this._state };
  }

  get isDevMode(): boolean {
    return this._state.active && this._state.target === "self";
  }

  activate(target: DevModeTarget = "self"): void {
    this._state.active = true;
    this._state.target = target;
    this._state.contextInjected = false;
  }

  deactivate(): void {
    this._state.active = false;
    this._state.contextInjected = false;
  }

  toggle(): void {
    if (this._state.active && this._state.target === "self") {
      this.deactivate();
    } else {
      this.activate("self");
    }
  }

  /**
   * Returns the context string to inject into the agent prompt
   * when Dev Mode is active. This gives the agent full awareness
   * of Dream IDE's architecture.
   */
  getContextForPrompt(): string | null {
    if (!this._state.active || this._state.target !== "self") {
      return null;
    }
    this._state.contextInjected = true;
    return generateDevModeSystemPrompt();
  }

  /**
   * Wraps a user message with dev mode context if active.
   * The context is prepended as a system block so the agent
   * knows it's working on Dream IDE itself.
   */
  wrapPrompt(userMessage: string): string {
    const context = this.getContextForPrompt();
    if (!context) return userMessage;

    return `${context}\n\n<user_request>\n${userMessage}\n</user_request>`;
  }

  /**
   * Get architecture nodes filtered by tag.
   */
  getNodesByTag(tag: string): ArchitectureNode[] {
    return ARCHITECTURE_MAP.filter((n) => n.tags.includes(tag));
  }

  /**
   * Get the dependency graph for a specific node.
   */
  getDependencyGraph(nodeName: string): ArchitectureNode[] {
    const node = ARCHITECTURE_MAP.find((n) => n.name === nodeName);
    if (!node) return [];

    const deps: ArchitectureNode[] = [];
    const visited = new Set<string>();

    const walk = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      const n = ARCHITECTURE_MAP.find((a) => a.name === name);
      if (n) {
        deps.push(n);
        n.dependencies.forEach(walk);
      }
    };

    node.dependencies.forEach(walk);
    return deps;
  }

  /**
   * Get quick actions filtered by category.
   */
  getQuickActions(category?: DevModeAction["category"]): DevModeAction[] {
    if (!category) return DEV_MODE_QUICK_ACTIONS;
    return DEV_MODE_QUICK_ACTIONS.filter((a) => a.category === category);
  }
}

// Singleton
export const devModeManager = new DevModeManager();
