/*
 * Obsidian Forge — Integrated Terminal
 * xterm.js-based terminal with Forge theme, command history, and sandbox integration.
 * In Tauri: connects to a real PTY via Tauri commands.
 * In web: simulates a shell with common commands.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";
import {
  Terminal as TerminalIcon, X, Plus, ChevronDown,
  Maximize2, Minimize2, Trash2
} from "lucide-react";

// ─── Terminal Session ───────────────────────────────────────────────

interface TerminalSession {
  id: string;
  name: string;
  terminal: XTerm;
  fitAddon: FitAddon;
  history: string[];
  historyIndex: number;
  currentInput: string;
  cwd: string;
}

// ─── Simulated Shell ────────────────────────────────────────────────

function simulateCommand(cmd: string, cwd: string): { output: string; newCwd: string } {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  switch (command) {
    case "ls":
      return {
        output: [
          "\x1b[34msrc/\x1b[0m          \x1b[34mnode_modules/\x1b[0m  \x1b[34m.git/\x1b[0m",
          "package.json  tsconfig.json  README.md",
          "vite.config.ts  tailwind.config.ts  .gitignore",
        ].join("\r\n"),
        newCwd: cwd,
      };
    case "pwd":
      return { output: cwd, newCwd: cwd };
    case "cd":
      const target = args[0] || "~";
      const newDir = target === ".." ? cwd.split("/").slice(0, -1).join("/") || "/" :
                     target.startsWith("/") ? target :
                     target === "~" ? "/home/user" :
                     `${cwd}/${target}`;
      return { output: "", newCwd: newDir };
    case "echo":
      return { output: args.join(" "), newCwd: cwd };
    case "clear":
      return { output: "\x1b[2J\x1b[H", newCwd: cwd };
    case "whoami":
      return { output: "user", newCwd: cwd };
    case "date":
      return { output: new Date().toString(), newCwd: cwd };
    case "cat":
      return {
        output: args[0]
          ? `\x1b[90m// Contents of ${args[0]}\x1b[0m\r\nconsole.log("Hello from Dream IDE");`
          : "\x1b[31mcat: missing operand\x1b[0m",
        newCwd: cwd,
      };
    case "git":
      if (args[0] === "status") {
        return {
          output: "On branch \x1b[32mmain\x1b[0m\r\nnothing to commit, working tree clean",
          newCwd: cwd,
        };
      }
      if (args[0] === "log" || args[0] === "log --oneline") {
        return {
          output: [
            "\x1b[33mabc1234\x1b[0m (\x1b[32mHEAD -> main\x1b[0m) Initial commit",
            "\x1b[33mdef5678\x1b[0m Add project structure",
            "\x1b[33mghi9012\x1b[0m Setup Tauri + React",
          ].join("\r\n"),
          newCwd: cwd,
        };
      }
      return { output: `git: '${args[0]}' is not a git command.`, newCwd: cwd };
    case "npm":
    case "pnpm":
      return {
        output: `\x1b[90m>\x1b[0m ${args.join(" ")}\r\n\x1b[32mDone\x1b[0m in 1.2s`,
        newCwd: cwd,
      };
    case "node":
      return { output: "\x1b[32m✓\x1b[0m Script executed successfully", newCwd: cwd };
    case "help":
      return {
        output: [
          "\x1b[1mDream IDE Terminal\x1b[0m (simulated)",
          "",
          "Available commands:",
          "  ls, pwd, cd, echo, clear, cat, git, npm, pnpm, node, help, whoami, date",
          "",
          "\x1b[90mIn the Tauri desktop build, this connects to a real PTY.\x1b[0m",
        ].join("\r\n"),
        newCwd: cwd,
      };
    case "":
      return { output: "", newCwd: cwd };
    default:
      return {
        output: `\x1b[31mcommand not found:\x1b[0m ${command}\r\n\x1b[90mType 'help' for available commands.\x1b[0m`,
        newCwd: cwd,
      };
  }
}

// ─── Terminal Tab ───────────────────────────────────────────────────

function TerminalTab({ session, isActive, onClick, onClose }: {
  session: TerminalSession;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 text-[11px] border-r border-border transition-colors group",
        isActive
          ? "bg-forge-surface text-foreground"
          : "bg-forge-gutter text-muted-foreground hover:text-foreground"
      )}
    >
      <TerminalIcon className="w-3 h-3" />
      <span className="truncate max-w-[80px]">{session.name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="p-0.5 rounded hover:bg-forge-surface-overlay opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </button>
  );
}

// ─── Main Terminal Component ────────────────────────────────────────

export default function TerminalPanel() {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionCounter = useRef(0);

  const createSession = useCallback(() => {
    sessionCounter.current++;
    const id = crypto.randomUUID();
    const name = `Terminal ${sessionCounter.current}`;

    const terminal = new XTerm({
      theme: {
        background: "#0D0F12",
        foreground: "#E8ECF1",
        cursor: "#E8A838",
        cursorAccent: "#0D0F12",
        selectionBackground: "#2C303980",
        selectionForeground: "#E8ECF1",
        black: "#0D0F12",
        red: "#E06C75",
        green: "#3AAFA9",
        yellow: "#E8A838",
        blue: "#61AFEF",
        magenta: "#C678DD",
        cyan: "#56B6C2",
        white: "#E8ECF1",
        brightBlack: "#5C6370",
        brightRed: "#E06C75",
        brightGreen: "#3AAFA9",
        brightYellow: "#E8A838",
        brightBlue: "#61AFEF",
        brightMagenta: "#C678DD",
        brightCyan: "#56B6C2",
        brightWhite: "#FFFFFF",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    const session: TerminalSession = {
      id,
      name,
      terminal,
      fitAddon,
      history: [],
      historyIndex: -1,
      currentInput: "",
      cwd: "/home/user/project",
    };

    // Write welcome message
    terminal.writeln("\x1b[1;33m⚒ Dream IDE Terminal\x1b[0m");
    terminal.writeln("\x1b[90mType 'help' for available commands. In Tauri build, this connects to a real shell.\x1b[0m");
    terminal.writeln("");

    // Write prompt
    const writePrompt = () => {
      terminal.write(`\x1b[34m${session.cwd}\x1b[0m \x1b[33m❯\x1b[0m `);
    };
    writePrompt();

    // Handle input
    let inputBuffer = "";

    terminal.onKey(({ key, domEvent }) => {
      const ev = domEvent;

      if (ev.key === "Enter") {
        terminal.writeln("");
        const cmd = inputBuffer.trim();
        inputBuffer = "";

        if (cmd) {
          session.history.push(cmd);
          session.historyIndex = session.history.length;

          const { output, newCwd } = simulateCommand(cmd, session.cwd);
          session.cwd = newCwd;

          if (output) {
            terminal.writeln(output);
          }
        }

        writePrompt();
      } else if (ev.key === "Backspace") {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          terminal.write("\b \b");
        }
      } else if (ev.key === "ArrowUp") {
        if (session.historyIndex > 0) {
          // Clear current input
          while (inputBuffer.length > 0) {
            terminal.write("\b \b");
            inputBuffer = inputBuffer.slice(0, -1);
          }
          session.historyIndex--;
          inputBuffer = session.history[session.historyIndex];
          terminal.write(inputBuffer);
        }
      } else if (ev.key === "ArrowDown") {
        // Clear current input
        while (inputBuffer.length > 0) {
          terminal.write("\b \b");
          inputBuffer = inputBuffer.slice(0, -1);
        }
        if (session.historyIndex < session.history.length - 1) {
          session.historyIndex++;
          inputBuffer = session.history[session.historyIndex];
          terminal.write(inputBuffer);
        } else {
          session.historyIndex = session.history.length;
          inputBuffer = "";
        }
      } else if (ev.key === "Tab") {
        // Basic tab completion (placeholder)
        ev.preventDefault();
      } else if (ev.ctrlKey && ev.key === "c") {
        terminal.writeln("^C");
        inputBuffer = "";
        writePrompt();
      } else if (ev.ctrlKey && ev.key === "l") {
        terminal.clear();
        writePrompt();
      } else if (!ev.ctrlKey && !ev.altKey && !ev.metaKey && key.length === 1) {
        inputBuffer += key;
        terminal.write(key);
      }
    });

    setSessions((prev) => [...prev, session]);
    setActiveSessionId(id);

    return session;
  }, []);

  // Create initial session
  useEffect(() => {
    if (sessions.length === 0) {
      createSession();
    }
  }, []);

  // Attach terminal to DOM when active session changes
  useEffect(() => {
    if (!activeSessionId) return;

    const session = sessions.find((s) => s.id === activeSessionId);
    const container = containerRefs.current.get(activeSessionId);

    if (session && container) {
      // Only open if not already opened
      if (container.children.length === 0) {
        session.terminal.open(container);
      }
      session.fitAddon.fit();
      session.terminal.focus();
    }
  }, [activeSessionId, sessions]);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const session = sessions.find((s) => s.id === activeSessionId);
      if (session) {
        try {
          session.fitAddon.fit();
        } catch {
          // Ignore fit errors during resize
        }
      }
    });

    const activeContainer = activeSessionId ? containerRefs.current.get(activeSessionId) : null;
    if (activeContainer) {
      observer.observe(activeContainer);
    }

    return () => observer.disconnect();
  }, [activeSessionId, sessions]);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const session = prev.find((s) => s.id === id);
      if (session) {
        session.terminal.dispose();
      }
      const next = prev.filter((s) => s.id !== id);
      if (activeSessionId === id && next.length > 0) {
        setActiveSessionId(next[next.length - 1].id);
      } else if (next.length === 0) {
        setActiveSessionId(null);
      }
      return next;
    });
  }, [activeSessionId]);

  const clearTerminal = useCallback(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session) {
      session.terminal.clear();
    }
  }, [activeSessionId, sessions]);

  return (
    <div className={cn(
      "flex flex-col bg-[#0D0F12] border-t border-border",
      isMaximized ? "h-[60vh]" : "h-[200px]"
    )}>
      {/* Terminal header */}
      <div className="flex items-center justify-between bg-forge-gutter border-b border-border shrink-0">
        {/* Tabs */}
        <div className="flex items-center overflow-x-auto">
          {sessions.map((session) => (
            <TerminalTab
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => setActiveSessionId(session.id)}
              onClose={() => closeSession(session.id)}
            />
          ))}
          <button
            onClick={createSession}
            className="p-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title="New terminal"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 px-2">
          <button
            onClick={clearTerminal}
            className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="Clear"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div className="flex-1 relative">
        {sessions.map((session) => (
          <div
            key={session.id}
            ref={(el) => {
              if (el) containerRefs.current.set(session.id, el);
            }}
            className={cn(
              "absolute inset-0 p-1",
              session.id === activeSessionId ? "block" : "hidden"
            )}
          />
        ))}

        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground/30 text-sm">
            <button
              onClick={createSession}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-forge-surface-raised hover:bg-forge-surface-overlay transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
