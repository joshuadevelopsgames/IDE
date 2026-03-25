/*
 * Obsidian Forge — Settings Panel
 * Tabbed settings: Agent, Models, MCP, Safety, Editor, Memory.
 */
import { useIDEStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Settings, Key, Shield, Code2, FolderOpen, Cpu, Plug,
  Eye, EyeOff, Save, Brain, Zap, ChevronRight
} from "lucide-react";
import { useState } from "react";
import MCPManager from "@/components/MCPManager";
import ModelSelector from "@/components/ModelSelector";
import { agentMemory } from "@/lib/agent-memory";

// ─── Shared UI ──────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2 pl-5">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-foreground/70 font-medium">{label}</label>
      {children}
      {hint && <p className="text-[9px] text-muted-foreground/40">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", mono = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === "password";

  return (
    <div className="relative">
      <input
        type={isSecret && !show ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-forge-surface-raised border border-border rounded px-2 py-1.5 text-[12px] text-foreground",
          "placeholder:text-muted-foreground/30 focus:border-forge-amber/50 focus:outline-none transition-colors",
          mono && "font-mono-code",
          isSecret && "pr-8"
        )}
      />
      {isSecret && (
        <button
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

function NumberInput({ value, onChange, min, max }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className="w-20 bg-forge-surface-raised border border-border rounded px-2 py-1.5 text-[12px] text-foreground font-mono-code focus:border-forge-amber/50 focus:outline-none transition-colors"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-[11px] text-foreground/70">{label}</span>}
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-8 h-[18px] rounded-full transition-colors duration-200",
          checked ? "bg-forge-amber" : "bg-forge-surface-overlay"
        )}
      >
        <div className={cn(
          "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-foreground transition-transform duration-200",
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        )} />
      </button>
    </div>
  );
}

// ─── Settings Tabs ──────────────────────────────────────────────────

type SettingsTab = "agent" | "models" | "mcp" | "safety" | "editor" | "memory";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "agent", label: "Agent", icon: <Cpu className="w-3 h-3" /> },
  { id: "models", label: "Models", icon: <Zap className="w-3 h-3" /> },
  { id: "mcp", label: "MCP", icon: <Plug className="w-3 h-3" /> },
  { id: "safety", label: "Safety", icon: <Shield className="w-3 h-3" /> },
  { id: "editor", label: "Editor", icon: <Code2 className="w-3 h-3" /> },
  { id: "memory", label: "Memory", icon: <Brain className="w-3 h-3" /> },
];

// ─── Tab Content ────────────────────────────────────────────────────

function AgentTab() {
  const { settings, updateSettings } = useIDEStore();

  return (
    <div className="space-y-6">
      <Section title="Hermes Agent" icon={<Cpu className="w-3 h-3" />}>
        <Field label="Hermes Binary Path" hint="Path to the hermes executable. Leave empty to use PATH.">
          <TextInput
            value={settings.hermesPath}
            onChange={(v) => updateSettings({ hermesPath: v })}
            placeholder="/usr/local/bin/hermes"
            mono
          />
        </Field>
        <Field label="Working Directory" hint="Default directory for agent operations.">
          <TextInput
            value={settings.workingDirectory}
            onChange={(v) => updateSettings({ workingDirectory: v })}
            placeholder="/home/user/projects"
            mono
          />
        </Field>
      </Section>

      <Section title="Autocomplete (Tabby)" icon={<Zap className="w-3 h-3" />}>
        <Toggle
          checked={settings.autocompleteEnabled}
          onChange={(v) => updateSettings({ autocompleteEnabled: v })}
          label="Enable Tab autocomplete"
        />
        <Field label="Completion Endpoint" hint="Tabby server URL or any OpenAI-compatible completions endpoint.">
          <TextInput
            value={settings.autocompleteEndpoint}
            onChange={(v) => updateSettings({ autocompleteEndpoint: v })}
            placeholder="http://localhost:8080/v1/completions"
            mono
          />
        </Field>
      </Section>
    </div>
  );
}

function ModelsTab() {
  return <ModelSelector />;
}

function MCPTab() {
  return <MCPManager />;
}

function SafetyTab() {
  const { settings, updateSettings } = useIDEStore();

  return (
    <Section title="Safety Guards" icon={<Shield className="w-3 h-3" />}>
      <Field label="Max Concurrent Tool Runs">
        <NumberInput
          value={settings.maxConcurrentTools}
          onChange={(v) => updateSettings({ maxConcurrentTools: v })}
          min={1}
          max={10}
        />
      </Field>
      <Toggle
        checked={settings.autoApproveRead}
        onChange={(v) => updateSettings({ autoApproveRead: v })}
        label="Auto-approve read operations"
      />
      <div className="space-y-1 mt-3">
        <div className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
          Blocked Commands
        </div>
        <div className="bg-forge-surface border border-border rounded p-2 space-y-0.5">
          {["rm -rf /", "rm -rf ~", "mkfs", "shutdown", "reboot", ":(){ :|:& };:"].map((cmd) => (
            <div key={cmd} className="flex items-center gap-1.5 text-[10px]">
              <Shield className="w-2.5 h-2.5 text-forge-coral/60" />
              <code className="font-mono-code text-forge-coral/80">{cmd}</code>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground/30">
          These commands are always blocked, even with "Always allow" enabled.
        </p>
      </div>
      <div className="space-y-1 mt-3">
        <div className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
          Secret Redaction
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          API keys, tokens, and passwords are automatically redacted in agent logs and chat history.
          Patterns: sk-*, ghp_*, AKIA*, Bearer tokens, and custom patterns.
        </p>
      </div>
    </Section>
  );
}

function EditorTab() {
  const { settings, updateSettings } = useIDEStore();

  return (
    <Section title="Editor Preferences" icon={<Code2 className="w-3 h-3" />}>
      <div className="flex items-center gap-4">
        <Field label="Font Size">
          <NumberInput
            value={settings.fontSize}
            onChange={(v) => updateSettings({ fontSize: v })}
            min={10}
            max={24}
          />
        </Field>
        <Field label="Tab Size">
          <NumberInput
            value={settings.tabSize}
            onChange={(v) => updateSettings({ tabSize: v })}
            min={1}
            max={8}
          />
        </Field>
      </div>
    </Section>
  );
}

function MemoryTab() {
  const stats = agentMemory.getStats();
  const instructions = agentMemory.getInstructions();
  const [newInstruction, setNewInstruction] = useState("");

  const handleAddInstruction = () => {
    if (!newInstruction.trim()) return;
    agentMemory.addInstruction(newInstruction.trim());
    setNewInstruction("");
  };

  return (
    <div className="space-y-4">
      <Section title="Agent Memory" icon={<Brain className="w-3 h-3" />}>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-forge-surface-raised border border-border rounded p-2 text-center">
            <div className="text-[16px] font-bold text-foreground">{stats.totalEntries}</div>
            <div className="text-[9px] text-muted-foreground/40">Total Memories</div>
          </div>
          <div className="bg-forge-surface-raised border border-border rounded p-2 text-center">
            <div className="text-[16px] font-bold text-foreground">{Object.keys(stats.byType).length}</div>
            <div className="text-[9px] text-muted-foreground/40">Categories</div>
          </div>
        </div>
        {Object.entries(stats.byType).length > 0 && (
          <div className="space-y-0.5">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground/60">{type.replace(/_/g, " ")}</span>
                <span className="text-foreground/50 font-mono-code">{count}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Project Instructions" icon={<Code2 className="w-3 h-3" />}>
        <p className="text-[10px] text-muted-foreground/50">
          Custom rules for the agent (equivalent to .cursorrules). These persist across sessions.
        </p>
        <div className="space-y-1">
          {instructions.map((inst) => (
            <div key={inst.id} className="flex items-start gap-1.5 bg-forge-surface-raised border border-border rounded p-2">
              <ChevronRight className="w-2.5 h-2.5 text-forge-amber mt-0.5 shrink-0" />
              <span className="text-[10px] text-foreground/70">{inst.content}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newInstruction}
            onChange={(e) => setNewInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddInstruction()}
            placeholder="Add a rule (e.g., 'Always use TypeScript strict mode')"
            className="flex-1 bg-forge-surface-raised border border-border rounded px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:border-forge-amber/50 focus:outline-none"
          />
          <button
            onClick={handleAddInstruction}
            disabled={!newInstruction.trim()}
            className="px-2 py-1.5 text-[10px] rounded bg-forge-amber/15 text-forge-amber hover:bg-forge-amber/25 transition-colors disabled:opacity-30"
          >
            Add
          </button>
        </div>
      </Section>

      <div className="pt-2 border-t border-border">
        <button
          onClick={() => {
            if (confirm("Clear all agent memories? This cannot be undone.")) {
              agentMemory.clear();
            }
          }}
          className="text-[10px] text-forge-coral/60 hover:text-forge-coral transition-colors"
        >
          Clear all memories
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("agent");

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-[12px] font-semibold text-foreground">Settings</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-forge-surface-raised text-forge-amber"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-forge-surface-raised/50"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "agent" && <AgentTab />}
        {activeTab === "models" && <ModelsTab />}
        {activeTab === "mcp" && <MCPTab />}
        {activeTab === "safety" && <SafetyTab />}
        {activeTab === "editor" && <EditorTab />}
        {activeTab === "memory" && <MemoryTab />}
      </div>
    </div>
  );
}
