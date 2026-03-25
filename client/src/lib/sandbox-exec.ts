/*
 * Obsidian Forge — Sandboxed Execution
 *
 * Provides safe terminal command execution with isolation,
 * resource limits, and audit logging.
 *
 * Integration path:
 *   Repo: https://github.com/e2b-dev/E2B (4.3k stars)
 *   E2B provides cloud sandboxes for AI agent code execution.
 *   For local execution: use Tauri's shell commands with cgroups/namespaces.
 *   For cloud execution: use E2B's API.
 *
 * Architecture:
 *   Agent → SandboxManager → [LocalSandbox | E2BSandbox]
 *   Each sandbox has: working directory, env vars, resource limits, audit log
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface SandboxConfig {
  mode: "local" | "e2b";
  workingDirectory: string;
  env: Record<string, string>;
  timeout: number;           // ms, default 30000
  maxOutputSize: number;     // bytes, default 1MB
  allowNetwork: boolean;
  allowedCommands?: string[];  // whitelist (if set, only these commands run)
  blockedCommands?: string[];  // blacklist
  e2bApiKey?: string;
  e2bTemplate?: string;
}

export interface CommandExecution {
  id: string;
  command: string;
  args: string[];
  status: "pending" | "running" | "completed" | "failed" | "timeout" | "killed";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  sandboxId: string;
}

export interface SandboxState {
  id: string;
  config: SandboxConfig;
  status: "idle" | "running" | "error";
  currentExecution: CommandExecution | null;
  history: CommandExecution[];
  createdAt: number;
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryMB: number;
  diskMB: number;
  networkBytesIn: number;
  networkBytesOut: number;
}

// ─── Default Config ─────────────────────────────────────────────────

export function getDefaultSandboxConfig(workingDirectory: string): SandboxConfig {
  return {
    mode: "local",
    workingDirectory,
    env: {},
    timeout: 30000,
    maxOutputSize: 1024 * 1024, // 1MB
    allowNetwork: true,
    blockedCommands: [
      "rm -rf /",
      "rm -rf ~",
      "mkfs",
      "dd if=/dev/zero",
      ":(){ :|:& };:",  // fork bomb
      "shutdown",
      "reboot",
      "halt",
      "poweroff",
    ],
  };
}

// ─── Command Validator ──────────────────────────────────────────────

export function validateCommand(command: string, config: SandboxConfig): {
  allowed: boolean;
  reason?: string;
} {
  const fullCmd = command.trim();

  // Check blocked commands
  if (config.blockedCommands) {
    for (const blocked of config.blockedCommands) {
      if (fullCmd.includes(blocked)) {
        return { allowed: false, reason: `Command contains blocked pattern: "${blocked}"` };
      }
    }
  }

  // Check allowed commands whitelist
  if (config.allowedCommands && config.allowedCommands.length > 0) {
    const cmdName = fullCmd.split(/\s+/)[0];
    if (!config.allowedCommands.includes(cmdName)) {
      return { allowed: false, reason: `Command "${cmdName}" is not in the allowed list` };
    }
  }

  // Check network access
  if (!config.allowNetwork) {
    const networkCommands = ["curl", "wget", "ssh", "scp", "rsync", "nc", "netcat", "telnet"];
    const cmdName = fullCmd.split(/\s+/)[0];
    if (networkCommands.includes(cmdName)) {
      return { allowed: false, reason: `Network access is disabled; "${cmdName}" is blocked` };
    }
  }

  return { allowed: true };
}

// ─── Sandbox Manager ────────────────────────────────────────────────

export class SandboxManager {
  private sandboxes: Map<string, SandboxState> = new Map();
  private listeners: Set<(states: SandboxState[]) => void> = new Set();

  onStateChange(handler: (states: SandboxState[]) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private notify(): void {
    const states = Array.from(this.sandboxes.values());
    this.listeners.forEach((h) => h(states));
  }

  // ─── Sandbox Lifecycle ────────────────────────────────────────────

  createSandbox(config: SandboxConfig): string {
    const id = crypto.randomUUID();
    this.sandboxes.set(id, {
      id,
      config,
      status: "idle",
      currentExecution: null,
      history: [],
      createdAt: Date.now(),
    });
    this.notify();
    return id;
  }

  destroySandbox(id: string): void {
    const sandbox = this.sandboxes.get(id);
    if (sandbox?.currentExecution?.status === "running") {
      this.killExecution(id);
    }
    this.sandboxes.delete(id);
    this.notify();
  }

  // ─── Command Execution ────────────────────────────────────────────

  async execute(sandboxId: string, command: string, args: string[] = []): Promise<CommandExecution> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullCommand = [command, ...args].join(" ");

    // Validate command
    const validation = validateCommand(fullCommand, sandbox.config);
    if (!validation.allowed) {
      const failed: CommandExecution = {
        id: crypto.randomUUID(),
        command,
        args,
        status: "failed",
        stdout: "",
        stderr: `Command blocked: ${validation.reason}`,
        exitCode: 1,
        startedAt: Date.now(),
        completedAt: Date.now(),
        durationMs: 0,
        sandboxId,
      };
      sandbox.history.push(failed);
      this.notify();
      return failed;
    }

    const execution: CommandExecution = {
      id: crypto.randomUUID(),
      command,
      args,
      status: "running",
      stdout: "",
      stderr: "",
      exitCode: null,
      startedAt: Date.now(),
      sandboxId,
    };

    sandbox.currentExecution = execution;
    sandbox.status = "running";
    this.notify();

    // In Tauri: invoke("sandbox_execute", { sandboxId, command, args })
    // In web prototype: simulate
    const result = await this.simulateExecution(execution, sandbox.config);

    sandbox.currentExecution = null;
    sandbox.status = "idle";
    sandbox.history.push(result);
    this.notify();

    return result;
  }

  killExecution(sandboxId: string): void {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox?.currentExecution) {
      sandbox.currentExecution.status = "killed";
      sandbox.currentExecution.completedAt = Date.now();
      sandbox.currentExecution.durationMs = Date.now() - sandbox.currentExecution.startedAt;
      sandbox.history.push(sandbox.currentExecution);
      sandbox.currentExecution = null;
      sandbox.status = "idle";
      this.notify();
    }
  }

  // ─── Getters ──────────────────────────────────────────────────────

  getSandbox(id: string): SandboxState | undefined {
    return this.sandboxes.get(id);
  }

  getAllSandboxes(): SandboxState[] {
    return Array.from(this.sandboxes.values());
  }

  getHistory(sandboxId: string): CommandExecution[] {
    return this.sandboxes.get(sandboxId)?.history || [];
  }

  // ─── Simulation ──────────────────────────────────────────────────

  private async simulateExecution(
    execution: CommandExecution,
    config: SandboxConfig
  ): Promise<CommandExecution> {
    const delay = 200 + Math.random() * 800;
    await new Promise((r) => setTimeout(r, delay));

    const cmd = execution.command;
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    // Simulate common commands
    if (cmd === "ls" || cmd === "dir") {
      stdout = "src/\npackage.json\ntsconfig.json\nREADME.md\nnode_modules/\n.git/";
    } else if (cmd === "pwd") {
      stdout = config.workingDirectory;
    } else if (cmd === "echo") {
      stdout = execution.args.join(" ");
    } else if (cmd === "cat") {
      stdout = `// Contents of ${execution.args[0] || "file"}\nconsole.log("Hello, World!");`;
    } else if (cmd === "npm" || cmd === "pnpm") {
      stdout = `> ${execution.args.join(" ")}\nDone in 2.3s`;
    } else if (cmd === "git") {
      if (execution.args[0] === "status") {
        stdout = "On branch main\nnothing to commit, working tree clean";
      } else if (execution.args[0] === "log") {
        stdout = "commit abc1234 (HEAD -> main)\nAuthor: User\nDate: Today\n\n    Initial commit";
      }
    } else if (cmd === "node" || cmd === "python" || cmd === "python3") {
      stdout = "Script executed successfully.";
    } else if (cmd === "cargo") {
      stdout = "   Compiling project v0.1.0\n    Finished dev [unoptimized + debuginfo] target(s) in 3.2s";
    } else {
      stdout = `[simulated] ${cmd} ${execution.args.join(" ")}`;
    }

    return {
      ...execution,
      status: exitCode === 0 ? "completed" : "failed",
      stdout,
      stderr,
      exitCode,
      completedAt: Date.now(),
      durationMs: Date.now() - execution.startedAt,
    };
  }
}

// Singleton
export const sandboxManager = new SandboxManager();
