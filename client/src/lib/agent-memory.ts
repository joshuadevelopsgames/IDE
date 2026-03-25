/*
 * Obsidian Forge — Agent Memory System
 *
 * Provides cross-session memory for the Hermes agent, similar to
 * Cursor's "Memories" feature. Stores project context, user preferences,
 * coding patterns, and past decisions.
 *
 * Integration path:
 *   Repo: https://github.com/mem0ai/mem0 (27.5k stars)
 *   In Tauri: use mem0 Python SDK as sidecar or local SQLite + embeddings
 *   In web: use localStorage with structured memory entries
 *
 * Architecture:
 *   Agent runs → Memory entries created → Stored locally
 *   Next run → Relevant memories retrieved → Injected into agent context
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  projectPath?: string;
  tags: string[];
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  importance: number; // 0-1, decays over time
}

export type MemoryType =
  | "project_context"     // Project structure, tech stack, conventions
  | "user_preference"     // Coding style, tool preferences
  | "decision"            // Past decisions and their reasoning
  | "error_fix"           // Errors encountered and how they were fixed
  | "pattern"             // Recurring code patterns
  | "instruction"         // User-defined rules (.cursorrules equivalent)
  | "conversation"        // Key conversation summaries
  | "file_context";       // Important file-level context

export interface MemorySearchResult {
  entry: MemoryEntry;
  relevance: number;
}

export interface MemoryStats {
  totalEntries: number;
  byType: Record<string, number>;
  oldestEntry: number;
  newestEntry: number;
}

// ─── Memory Store ───────────────────────────────────────────────────

const MEMORY_STORAGE_KEY = "dream-ide-agent-memory";
const MAX_MEMORIES = 500;
const DECAY_RATE = 0.001; // importance decay per hour

export class AgentMemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  add(entry: Omit<MemoryEntry, "id" | "createdAt" | "lastAccessedAt" | "accessCount">): MemoryEntry {
    const id = crypto.randomUUID();
    const now = Date.now();

    const newEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    };

    this.entries.set(id, newEntry);
    this.enforceLimit();
    this.saveToStorage();

    return newEntry;
  }

  get(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      this.saveToStorage();
    }
    return entry;
  }

  update(id: string, updates: Partial<MemoryEntry>): void {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, updates, { lastAccessedAt: Date.now() });
      this.saveToStorage();
    }
  }

  remove(id: string): void {
    this.entries.delete(id);
    this.saveToStorage();
  }

  clear(): void {
    this.entries.clear();
    this.saveToStorage();
  }

  // ─── Search ───────────────────────────────────────────────────────

  search(query: string, options?: {
    type?: MemoryType;
    projectPath?: string;
    tags?: string[];
    limit?: number;
  }): MemorySearchResult[] {
    const limit = options?.limit || 10;
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);
    const results: MemorySearchResult[] = [];

    for (const entry of Array.from(this.entries.values())) {
      // Filter by type
      if (options?.type && entry.type !== options.type) continue;
      // Filter by project
      if (options?.projectPath && entry.projectPath !== options.projectPath) continue;
      // Filter by tags
      if (options?.tags && !options.tags.some((t) => entry.tags.includes(t))) continue;

      // Calculate relevance
      let relevance = 0;
      const contentLower = entry.content.toLowerCase();
      const tagsLower = entry.tags.map((t) => t.toLowerCase());

      // Word match scoring
      for (const word of queryWords) {
        if (contentLower.includes(word)) relevance += 20;
        if (tagsLower.some((t) => t.includes(word))) relevance += 15;
      }

      // Exact phrase match bonus
      if (contentLower.includes(queryLower)) relevance += 30;

      // Recency bonus (more recent = more relevant)
      const hoursAgo = (Date.now() - entry.lastAccessedAt) / 3600000;
      relevance += Math.max(0, 10 - hoursAgo * 0.1);

      // Importance factor
      relevance *= entry.importance;

      // Access frequency bonus
      relevance += Math.min(entry.accessCount * 2, 10);

      if (relevance > 5) {
        results.push({ entry, relevance });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  // ─── Context Retrieval (for agent injection) ──────────────────────

  getRelevantContext(query: string, projectPath?: string): string {
    const memories = this.search(query, { projectPath, limit: 5 });

    if (memories.length === 0) return "";

    const sections = memories.map((m) => {
      const typeLabel = m.entry.type.replace(/_/g, " ");
      return `[${typeLabel}] ${m.entry.content}`;
    });

    return `<agent_memory>\n${sections.join("\n\n")}\n</agent_memory>`;
  }

  // ─── Instructions (.cursorrules equivalent) ───────────────────────

  getInstructions(projectPath?: string): MemoryEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => e.type === "instruction" && (!projectPath || e.projectPath === projectPath))
      .sort((a, b) => b.importance - a.importance);
  }

  addInstruction(content: string, projectPath?: string): MemoryEntry {
    return this.add({
      type: "instruction",
      content,
      metadata: {},
      projectPath,
      tags: ["instruction", "rules"],
      importance: 1.0,
    });
  }

  // ─── Auto-memory from agent runs ─────────────────────────────────

  recordDecision(decision: string, reasoning: string, projectPath?: string): MemoryEntry {
    return this.add({
      type: "decision",
      content: `Decision: ${decision}\nReasoning: ${reasoning}`,
      metadata: { decision, reasoning },
      projectPath,
      tags: ["decision"],
      importance: 0.7,
    });
  }

  recordErrorFix(error: string, fix: string, projectPath?: string): MemoryEntry {
    return this.add({
      type: "error_fix",
      content: `Error: ${error}\nFix: ${fix}`,
      metadata: { error, fix },
      projectPath,
      tags: ["error", "fix", "debugging"],
      importance: 0.8,
    });
  }

  recordPattern(pattern: string, example: string, projectPath?: string): MemoryEntry {
    return this.add({
      type: "pattern",
      content: `Pattern: ${pattern}\nExample: ${example}`,
      metadata: { pattern, example },
      projectPath,
      tags: ["pattern", "convention"],
      importance: 0.6,
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────

  getStats(): MemoryStats {
    const byType: Record<string, number> = {};
    let oldest = Infinity;
    let newest = 0;

    for (const entry of Array.from(this.entries.values())) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      if (entry.createdAt < oldest) oldest = entry.createdAt;
      if (entry.createdAt > newest) newest = entry.createdAt;
    }

    return {
      totalEntries: this.entries.size,
      byType,
      oldestEntry: oldest === Infinity ? 0 : oldest,
      newestEntry: newest,
    };
  }

  // ─── Persistence ──────────────────────────────────────────────────

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as MemoryEntry[];
      for (const entry of data) {
        // Apply importance decay
        const hoursAgo = (Date.now() - entry.lastAccessedAt) / 3600000;
        entry.importance = Math.max(0.1, entry.importance - hoursAgo * DECAY_RATE);
        this.entries.set(entry.id, entry);
      }
    } catch {
      // Silently fail
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.entries.values());
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full — evict oldest entries
      this.enforceLimit();
    }
  }

  private enforceLimit(): void {
    if (this.entries.size <= MAX_MEMORIES) return;

    // Sort by importance * recency, remove lowest
    const sorted = Array.from(this.entries.values()).sort((a, b) => {
      const scoreA = a.importance * (1 / (1 + (Date.now() - a.lastAccessedAt) / 86400000));
      const scoreB = b.importance * (1 / (1 + (Date.now() - b.lastAccessedAt) / 86400000));
      return scoreA - scoreB;
    });

    const toRemove = sorted.slice(0, this.entries.size - MAX_MEMORIES);
    for (const entry of toRemove) {
      this.entries.delete(entry.id);
    }
  }
}

// Singleton
export const agentMemory = new AgentMemoryStore();
