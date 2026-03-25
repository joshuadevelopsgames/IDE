/*
 * Obsidian Forge — Dev Mode Panel
 *
 * When IDE Dev Mode is active, this panel replaces the empty state in ChatThread
 * and provides:
 *   1. Architecture Explorer — visual map of Dream IDE's components and modules
 *   2. Quick Actions — pre-built prompts for common IDE development tasks
 *   3. Dependency Graph — shows how modules connect
 *   4. Convention Reference — quick access to design system and coding rules
 */
import { useState, useMemo } from "react";
import {
  Code2, Layers, Zap, FileText, GitBranch, Palette,
  ChevronDown, ChevronRight, Box, Puzzle, Layout,
  BookOpen, Wrench, Bug, Paintbrush, FileCode,
  ArrowRight, ExternalLink, Sparkles, Shield,
  Database, Terminal, Search, Eye, Cpu
} from "lucide-react";
import {
  ARCHITECTURE_MAP, DEV_MODE_QUICK_ACTIONS,
  DESIGN_SYSTEM_CONTEXT, CONVENTION_RULES,
  type ArchitectureNode, type DevModeAction,
  devModeManager
} from "@/lib/dev-mode";
import { cn } from "@/lib/utils";

// ─── Architecture Node Card ────────────────────────────────────────

const typeIcons: Record<ArchitectureNode["type"], React.ReactNode> = {
  page: <Layout className="w-3 h-3" />,
  component: <Box className="w-3 h-3" />,
  module: <Puzzle className="w-3 h-3" />,
  hook: <Zap className="w-3 h-3" />,
  context: <Layers className="w-3 h-3" />,
  config: <FileText className="w-3 h-3" />,
  style: <Palette className="w-3 h-3" />,
};

const typeColors: Record<ArchitectureNode["type"], string> = {
  page: "text-blue-400 bg-blue-400/10",
  component: "text-emerald-400 bg-emerald-400/10",
  module: "text-forge-amber bg-forge-amber/10",
  hook: "text-purple-400 bg-purple-400/10",
  context: "text-cyan-400 bg-cyan-400/10",
  config: "text-muted-foreground bg-muted/30",
  style: "text-pink-400 bg-pink-400/10",
};

function ArchNodeCard({ node, onSelect }: { node: ArchitectureNode; onSelect: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/50 rounded-md bg-forge-surface-raised/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-2 text-left hover:bg-forge-surface-overlay/30 transition-colors"
      >
        <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", typeColors[node.type])}>
          {typeIcons[node.type]}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11.5px] font-semibold text-foreground">{node.name}</span>
          <span className="text-[10px] text-muted-foreground/40 ml-1.5 font-mono-code">{node.type}</span>
        </div>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground/30" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/30 pt-2">
          <p className="text-[10.5px] text-muted-foreground/60 leading-relaxed">{node.description}</p>

          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/30 font-mono-code">
            <FileCode className="w-2.5 h-2.5" />
            <span>{node.path}</span>
          </div>

          {node.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {node.dependencies.map((dep) => (
                <span key={dep} className="text-[9px] px-1.5 py-0.5 rounded bg-forge-surface-overlay text-muted-foreground/40 font-mono-code">
                  {dep}
                </span>
              ))}
            </div>
          )}

          {node.exports.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {node.exports.slice(0, 5).map((exp) => (
                <span key={exp} className="text-[9px] px-1.5 py-0.5 rounded bg-forge-amber/5 text-forge-amber/50 font-mono-code">
                  {exp}
                </span>
              ))}
              {node.exports.length > 5 && (
                <span className="text-[9px] text-muted-foreground/25">+{node.exports.length - 5} more</span>
              )}
            </div>
          )}

          <button
            onClick={() => onSelect(`Open and analyze ${node.path}. Explain its current implementation and suggest improvements.`)}
            className="flex items-center gap-1 text-[10px] text-forge-amber/60 hover:text-forge-amber transition-colors mt-1"
          >
            <Eye className="w-3 h-3" />
            <span>Analyze with AI</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Quick Action Card ─────────────────────────────────────────────

const categoryIcons: Record<DevModeAction["category"], React.ReactNode> = {
  feature: <Sparkles className="w-3 h-3" />,
  fix: <Bug className="w-3 h-3" />,
  refactor: <Wrench className="w-3 h-3" />,
  design: <Paintbrush className="w-3 h-3" />,
  docs: <BookOpen className="w-3 h-3" />,
};

const categoryColors: Record<DevModeAction["category"], string> = {
  feature: "text-forge-amber bg-forge-amber/10",
  fix: "text-forge-coral bg-forge-coral/10",
  refactor: "text-blue-400 bg-blue-400/10",
  design: "text-purple-400 bg-purple-400/10",
  docs: "text-emerald-400 bg-emerald-400/10",
};

function QuickActionCard({ action, onSelect }: { action: DevModeAction; onSelect: (prompt: string) => void }) {
  return (
    <button
      onClick={() => onSelect(action.prompt)}
      className="flex items-start gap-2.5 w-full p-2.5 rounded-md border border-border/30 hover:border-forge-amber/20 hover:bg-forge-surface-raised/50 transition-all text-left group"
    >
      <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5", categoryColors[action.category])}>
        {categoryIcons[action.category]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] font-medium text-foreground group-hover:text-forge-amber transition-colors">
          {action.label}
        </p>
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed mt-0.5">
          {action.description}
        </p>
      </div>
      <ArrowRight className="w-3 h-3 text-muted-foreground/15 group-hover:text-forge-amber/50 transition-colors shrink-0 mt-1" />
    </button>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────

type DevTab = "actions" | "architecture" | "design" | "conventions";

export default function DevModePanel({ onSendPrompt }: { onSendPrompt: (prompt: string) => void }) {
  const [activeTab, setActiveTab] = useState<DevTab>("actions");
  const [archFilter, setArchFilter] = useState<"all" | ArchitectureNode["type"]>("all");
  const [actionFilter, setActionFilter] = useState<"all" | DevModeAction["category"]>("all");

  const filteredNodes = useMemo(() => {
    if (archFilter === "all") return ARCHITECTURE_MAP;
    return ARCHITECTURE_MAP.filter((n) => n.type === archFilter);
  }, [archFilter]);

  const filteredActions = useMemo(() => {
    if (actionFilter === "all") return DEV_MODE_QUICK_ACTIONS;
    return DEV_MODE_QUICK_ACTIONS.filter((a) => a.category === actionFilter);
  }, [actionFilter]);

  const tabs: { id: DevTab; label: string; icon: React.ReactNode }[] = [
    { id: "actions", label: "Actions", icon: <Zap className="w-3 h-3" /> },
    { id: "architecture", label: "Architecture", icon: <Layers className="w-3 h-3" /> },
    { id: "design", label: "Design", icon: <Palette className="w-3 h-3" /> },
    { id: "conventions", label: "Code", icon: <Code2 className="w-3 h-3" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-forge-amber/15 flex items-center justify-center">
            <Cpu className="w-3 h-3 text-forge-amber" />
          </div>
          <span className="text-[12px] font-semibold text-foreground">IDE Dev Mode</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-forge-amber/10 text-forge-amber font-medium ml-auto">
            SELF
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          Develop Dream IDE with AI assistance. The agent has full knowledge of the codebase architecture.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/50 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
              activeTab === tab.id
                ? "bg-forge-surface-raised text-forge-amber"
                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-forge-surface-raised/50"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === "actions" && (
          <div className="space-y-2">
            {/* Category filter */}
            <div className="flex flex-wrap gap-1 mb-2">
              {(["all", "feature", "fix", "refactor", "design", "docs"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActionFilter(cat)}
                  className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full transition-colors",
                    actionFilter === cat
                      ? "bg-forge-amber/15 text-forge-amber"
                      : "bg-forge-surface-raised text-muted-foreground/30 hover:text-muted-foreground/50"
                  )}
                >
                  {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {filteredActions.map((action) => (
              <QuickActionCard key={action.id} action={action} onSelect={onSendPrompt} />
            ))}
          </div>
        )}

        {activeTab === "architecture" && (
          <div className="space-y-2">
            {/* Type filter */}
            <div className="flex flex-wrap gap-1 mb-2">
              {(["all", "page", "component", "module"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setArchFilter(type)}
                  className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full transition-colors",
                    archFilter === type
                      ? "bg-forge-amber/15 text-forge-amber"
                      : "bg-forge-surface-raised text-muted-foreground/30 hover:text-muted-foreground/50"
                  )}
                >
                  {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1) + "s"}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/30 mb-1 px-1">
              <span>{ARCHITECTURE_MAP.filter((n) => n.type === "page").length} pages</span>
              <span>{ARCHITECTURE_MAP.filter((n) => n.type === "component").length} components</span>
              <span>{ARCHITECTURE_MAP.filter((n) => n.type === "module").length} modules</span>
            </div>

            {filteredNodes.map((node) => (
              <ArchNodeCard key={node.name} node={node} onSelect={onSendPrompt} />
            ))}
          </div>
        )}

        {activeTab === "design" && (
          <div className="space-y-3">
            {/* Color palette preview */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Color Tokens</h3>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { name: "Background", color: "#0D0F12", token: "forge-bg" },
                  { name: "Surface", color: "#161A1F", token: "forge-surface" },
                  { name: "Raised", color: "#1E2228", token: "forge-surface-raised" },
                  { name: "Overlay", color: "#262B33", token: "forge-surface-overlay" },
                  { name: "Amber", color: "#E8A838", token: "forge-amber" },
                  { name: "Teal", color: "#4ECDC4", token: "forge-teal" },
                  { name: "Coral", color: "#E85D4A", token: "forge-coral" },
                  { name: "Gutter", color: "#131619", token: "forge-gutter" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-2 p-1.5 rounded bg-forge-surface-raised/30">
                    <div className="w-4 h-4 rounded-sm border border-border/30 shrink-0" style={{ backgroundColor: c.color }} />
                    <div className="min-w-0">
                      <p className="text-[10px] text-foreground/70">{c.name}</p>
                      <p className="text-[8px] text-muted-foreground/30 font-mono-code truncate">{c.token}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Typography</h3>
              <div className="space-y-1 p-2 rounded bg-forge-surface-raised/30">
                <p className="font-mono-code text-[13px] text-foreground">JetBrains Mono — Headers & Code</p>
                <p className="font-sans text-[13px] text-foreground">IBM Plex Sans — Body & UI</p>
                <div className="flex gap-3 mt-1">
                  {["10px", "11px", "12px", "13px", "14px"].map((s) => (
                    <span key={s} className="text-muted-foreground/40" style={{ fontSize: s }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick design prompts */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Design Prompts</h3>
              {[
                "Audit the current color contrast ratios and fix any accessibility issues",
                "Add a subtle forge pulse glow animation to the activity bar when agent is active",
                "Improve the empty state illustrations with more personality",
              ].map((p, i) => (
                <button
                  key={i}
                  onClick={() => onSendPrompt(p)}
                  className="flex items-center gap-2 w-full p-2 rounded text-left text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-forge-surface-raised/50 transition-colors"
                >
                  <Paintbrush className="w-3 h-3 shrink-0" />
                  <span>{p}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "conventions" && (
          <div className="space-y-3">
            {/* Quick reference cards */}
            {[
              { title: "File Organization", items: ["Pages → client/src/pages/", "Components → client/src/components/", "Modules → client/src/lib/", "Styles → client/src/index.css"] },
              { title: "State Management", items: ["Single Zustand store + immer", "Types from store.ts are canonical", "Components read via useIDEStore()", "No cross-cutting local state"] },
              { title: "Styling", items: ["Tailwind utilities only", "forge-* custom colors", "font-mono-code for monospace", "text-[Npx] for font sizes"] },
              { title: "Components", items: ["Function components only", "cn() for conditional classes", "Lucide icons (individual imports)", "shadcn/ui base, extend don't replace"] },
              { title: "Agent Bridge", items: ["hermes-bridge.ts singleton", "ACP events → source of truth", "ChatThread renders event blocks", "Safety validation on all tools"] },
            ].map((section) => (
              <div key={section.title} className="space-y-1">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">{section.title}</h3>
                <div className="space-y-0.5 p-2 rounded bg-forge-surface-raised/30">
                  {section.items.map((item, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground/50 font-mono-code">
                      <span className="text-muted-foreground/20 mr-1">›</span> {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {/* Convention prompts */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Convention Prompts</h3>
              {[
                "Review the codebase for convention violations and list them",
                "Generate TypeDoc comments for all exported functions in lib/",
                "Check for unused imports and dead code across the project",
              ].map((p, i) => (
                <button
                  key={i}
                  onClick={() => onSendPrompt(p)}
                  className="flex items-center gap-2 w-full p-2 rounded text-left text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-forge-surface-raised/50 transition-colors"
                >
                  <Code2 className="w-3 h-3 shrink-0" />
                  <span>{p}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
