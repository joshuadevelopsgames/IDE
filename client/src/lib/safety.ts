/*
 * Obsidian Forge — Safety Guards
 * 
 * Implements the safety layer between Hermes Agent and the user:
 * - Secret redaction in logs and UI
 * - Dangerous command detection (rm, chmod, etc.)
 * - Concurrent tool run caps
 * - Crash recovery state persistence
 */

// ─── Secret Redaction ────────────────────────────────────────────────

const SECRET_PATTERNS = [
  // API keys
  /(?:sk|pk|api[_-]?key|token|secret|password|auth)[_-]?\w*[\s=:]+["']?([A-Za-z0-9_\-./+=]{20,})["']?/gi,
  // AWS
  /AKIA[0-9A-Z]{16}/g,
  // GitHub tokens
  /gh[ps]_[A-Za-z0-9_]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  // Generic long secrets
  /(?:Bearer|Basic)\s+[A-Za-z0-9+/=_\-.]{20,}/gi,
  // Environment variable assignments with secrets
  /(?:export\s+)?(?:API_KEY|SECRET|TOKEN|PASSWORD|AUTH)\w*=["']?[^\s"']+["']?/gi,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Keep first 4 and last 4 chars, redact middle
      if (match.length > 12) {
        return match.slice(0, 6) + "***REDACTED***" + match.slice(-4);
      }
      return "***REDACTED***";
    });
  }
  return result;
}

// ─── Dangerous Command Detection ─────────────────────────────────────

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  reasons: string[];
  requiresApproval: boolean;
}

const DANGEROUS_PATTERNS: { pattern: RegExp; level: "medium" | "high"; reason: string }[] = [
  { pattern: /\brm\s+(-[rf]+\s+)?[/~]/, level: "high", reason: "Deletes files or directories" },
  { pattern: /\brm\s+-rf?\s/, level: "high", reason: "Recursive file deletion" },
  { pattern: /\brmdir\b/, level: "medium", reason: "Removes directories" },
  { pattern: /\bchmod\s+[0-7]{3,4}\b/, level: "medium", reason: "Changes file permissions" },
  { pattern: /\bchown\b/, level: "medium", reason: "Changes file ownership" },
  { pattern: /\bsudo\b/, level: "high", reason: "Elevated privileges" },
  { pattern: /\bcurl\b.*\|\s*(?:bash|sh|zsh)/, level: "high", reason: "Pipes remote script to shell" },
  { pattern: /\bwget\b.*\|\s*(?:bash|sh|zsh)/, level: "high", reason: "Pipes remote script to shell" },
  { pattern: /\bdd\s+if=/, level: "high", reason: "Low-level disk write" },
  { pattern: /\bmkfs\b/, level: "high", reason: "Formats filesystem" },
  { pattern: />\s*\/dev\//, level: "high", reason: "Writes to device file" },
  { pattern: /\bgit\s+push\s+(-f|--force)/, level: "high", reason: "Force push to remote" },
  { pattern: /\bgit\s+reset\s+--hard/, level: "medium", reason: "Hard reset discards changes" },
  { pattern: /\bnpm\s+publish\b/, level: "medium", reason: "Publishes package to registry" },
  { pattern: /\.env\b/, level: "medium", reason: "Modifies environment file" },
  { pattern: /\bkill\s+-9\b/, level: "medium", reason: "Force kills process" },
  { pattern: /\bdrop\s+(?:table|database)\b/i, level: "high", reason: "Drops database objects" },
  { pattern: /\btruncate\s+table\b/i, level: "high", reason: "Truncates database table" },
  { pattern: /\bdelete\s+from\b/i, level: "medium", reason: "Deletes database records" },
];

export function assessToolRisk(tool: string, args: Record<string, unknown>): RiskAssessment {
  const reasons: string[] = [];
  let maxLevel: "low" | "medium" | "high" = "low";

  // Check terminal commands
  if (tool.includes("terminal") || tool.includes("run") || tool.includes("exec")) {
    const command = String(args.command || args.cmd || "");
    for (const { pattern, level, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        reasons.push(reason);
        if (level === "high") maxLevel = "high";
        else if (level === "medium" && maxLevel !== "high") maxLevel = "medium";
      }
    }
  }

  // Check file write operations
  if (tool.includes("write") || tool.includes("edit") || tool.includes("patch")) {
    const path = String(args.path || args.file || "");
    if (path.includes(".env")) {
      reasons.push("Modifies environment configuration");
      if (maxLevel === "low") maxLevel = "medium";
    }
    if (path.includes("package.json") || path.includes("Cargo.toml")) {
      reasons.push("Modifies project dependencies");
      if (maxLevel === "low") maxLevel = "medium";
    }
    if (path.startsWith("/etc/") || path.startsWith("/usr/") || path.startsWith("/sys/")) {
      reasons.push("Modifies system files");
      maxLevel = "high";
    }
  }

  // Check delete operations
  if (tool.includes("delete") || tool.includes("remove")) {
    reasons.push("Deletes files or resources");
    if (maxLevel === "low") maxLevel = "medium";
  }

  return {
    level: maxLevel,
    reasons,
    requiresApproval: maxLevel !== "low",
  };
}

// ─── Concurrent Tool Cap ─────────────────────────────────────────────

export class ToolRunLimiter {
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(private maxConcurrent: number = 3) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }

  get activeCount(): number {
    return this.running;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    // Drain queue if we increased the limit
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// ─── Crash Recovery ──────────────────────────────────────────────────

const RECOVERY_KEY = "dream-ide-recovery-state";

export interface RecoveryState {
  timestamp: number;
  projectPath: string | null;
  openTabs: { path: string; content: string; isDirty: boolean }[];
  activeTabPath: string | null;
  agentSessionId: string | null;
  lastRunId: string | null;
  rightPanel: string;
}

export function saveRecoveryState(state: RecoveryState): void {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[Recovery] Failed to save state:", e);
  }
}

export function loadRecoveryState(): RecoveryState | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as RecoveryState;
    // Only recover if less than 1 hour old
    if (Date.now() - state.timestamp > 3600000) {
      localStorage.removeItem(RECOVERY_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function clearRecoveryState(): void {
  localStorage.removeItem(RECOVERY_KEY);
}

// ─── Auto-save recovery state periodically ───────────────────────────

let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoRecovery(getState: () => RecoveryState): void {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    saveRecoveryState(getState());
  }, 10000); // Every 10 seconds

  // Also save on beforeunload
  window.addEventListener("beforeunload", () => {
    saveRecoveryState(getState());
  });
}

export function stopAutoRecovery(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}
