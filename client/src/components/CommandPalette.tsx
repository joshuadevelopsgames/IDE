/*
 * Obsidian Forge — Command Palette
 * Ctrl+K / Cmd+K quick-access overlay with fuzzy search.
 */
import { useEffect, useState, useMemo } from "react";
import {
  Search, File, Settings, MessageSquare, ShieldAlert,
  Play, FolderOpen, Terminal, GitCompare, Command, Cpu
} from "lucide-react";
import { useIDEStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette() {
  const {
    commandPaletteOpen, setCommandPaletteOpen,
    setRightPanel, setActiveView, setTerminalOpen,
    fileTree, devModeActive, toggleDevMode
  } = useIDEStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: "open-project",
      label: "Open Project",
      category: "Navigation",
      icon: <FolderOpen className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+O",
      action: () => { setActiveView("home"); setCommandPaletteOpen(false); },
    },
    {
      id: "agent-panel",
      label: "Show Agent Panel",
      category: "Panels",
      icon: <Play className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+1",
      action: () => { setRightPanel("chat"); setCommandPaletteOpen(false); },
    },
    {
      id: "chat-panel",
      label: "Show Chat",
      category: "Panels",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+2",
      action: () => { setRightPanel("chat"); setCommandPaletteOpen(false); },
    },
    {
      id: "approvals-panel",
      label: "Show Approvals",
      category: "Panels",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+3",
      action: () => { setRightPanel("approvals"); setCommandPaletteOpen(false); },
    },
    {
      id: "settings-panel",
      label: "Open Settings",
      category: "Panels",
      icon: <Settings className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+,",
      action: () => { setRightPanel("settings"); setCommandPaletteOpen(false); },
    },
    {
      id: "toggle-terminal",
      label: "Toggle Terminal",
      category: "Tools",
      icon: <Terminal className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+`",
      action: () => { setTerminalOpen(true); setCommandPaletteOpen(false); },
    },
    {
      id: "toggle-diff",
      label: "Toggle Diff View",
      category: "Editor",
      icon: <GitCompare className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+Shift+D",
      action: () => { setCommandPaletteOpen(false); },
    },
    {
      id: "toggle-dev-mode",
      label: devModeActive ? "Deactivate IDE Dev Mode" : "Activate IDE Dev Mode",
      category: "Dev Mode",
      icon: <Cpu className="w-3.5 h-3.5" />,
      shortcut: "Ctrl+Shift+M",
      action: () => { toggleDevMode(); setCommandPaletteOpen(false); },
    },
    {
      id: "dev-mode-panel",
      label: "Show Dev Mode Panel",
      category: "Dev Mode",
      icon: <Cpu className="w-3.5 h-3.5" />,
      action: () => { setRightPanel("devmode"); setCommandPaletteOpen(false); },
    },
  ], [setActiveView, setRightPanel, setCommandPaletteOpen, setTerminalOpen, devModeActive, toggleDevMode]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        setQuery("");
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-[520px] bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none"
          />
          <kbd className="text-[9px] text-muted-foreground/40 bg-forge-surface-raised px-1.5 py-0.5 rounded font-mono-code">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground/40">
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
                  i === selectedIndex
                    ? "bg-forge-surface-raised text-foreground"
                    : "text-muted-foreground hover:bg-forge-surface-raised/50"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded flex items-center justify-center shrink-0",
                  i === selectedIndex ? "bg-forge-amber/15 text-forge-amber" : "bg-forge-surface-overlay"
                )}>
                  {cmd.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px]">{cmd.label}</span>
                  <span className="text-[10px] text-muted-foreground/40 ml-2">{cmd.category}</span>
                </div>
                {cmd.shortcut && (
                  <kbd className="text-[9px] text-muted-foreground/30 bg-forge-gutter px-1.5 py-0.5 rounded font-mono-code shrink-0">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
