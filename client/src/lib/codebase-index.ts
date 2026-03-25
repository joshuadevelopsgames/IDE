/*
 * Obsidian Forge — Codebase Indexing & Semantic Search
 *
 * Indexes the workspace for fast file search, symbol lookup, and
 * semantic code search using embeddings.
 *
 * Integration path:
 *   Repo: https://github.com/nicoritschel/tree-sitter-wasm (tree-sitter for parsing)
 *   Repo: https://github.com/nicoritschel/lancedb (vector DB for embeddings)
 *   In Tauri: use Rust tree-sitter + lancedb for native performance
 *   In web: use in-memory trigram index for fast fuzzy search
 *
 * Architecture:
 *   File Watcher → Parser (tree-sitter) → Symbol Extractor → Index
 *   Search Query → Trigram Match + Embedding Similarity → Ranked Results
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface IndexedFile {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  lastModified: number;
  symbols: CodeSymbol[];
  trigrams: Set<string>;
  lines: number;
}

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  line: number;
  column: number;
  endLine: number;
  filePath: string;
  detail?: string;
  children?: CodeSymbol[];
}

export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "variable"
  | "constant"
  | "enum"
  | "method"
  | "property"
  | "import"
  | "export"
  | "module"
  | "namespace";

export interface SearchResult {
  type: "file" | "symbol" | "content";
  path: string;
  name: string;
  detail?: string;
  line?: number;
  column?: number;
  matchScore: number;
  matchRanges?: Array<{ start: number; end: number }>;
}

export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  totalLines: number;
  indexedAt: number;
  indexDurationMs: number;
  languages: Record<string, number>;
}

// ─── Trigram Index ──────────────────────────────────────────────────

function extractTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  const lower = text.toLowerCase();
  for (let i = 0; i <= lower.length - 3; i++) {
    trigrams.add(lower.slice(i, i + 3));
  }
  return trigrams;
}

function trigramSimilarity(query: Set<string>, target: Set<string>): number {
  if (query.size === 0 || target.size === 0) return 0;
  let intersection = 0;
  for (const t of Array.from(query)) {
    if (target.has(t)) intersection++;
  }
  return intersection / Math.max(query.size, 1);
}

// ─── Symbol Extraction (Regex-based for web prototype) ──────────────

function extractSymbols(content: string, filePath: string, language: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (language === "typescript" || language === "javascript" || language === "typescriptreact" || language === "javascriptreact") {
      // Functions
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: "function", line: lineNum, column: (fnMatch.index || 0) + 1, endLine: lineNum, filePath });
      }

      // Arrow functions assigned to const
      const arrowMatch = line.match(/(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
      if (arrowMatch) {
        symbols.push({ name: arrowMatch[1], kind: "function", line: lineNum, column: (arrowMatch.index || 0) + 1, endLine: lineNum, filePath });
      }

      // Interfaces
      const ifaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
      if (ifaceMatch) {
        symbols.push({ name: ifaceMatch[1], kind: "interface", line: lineNum, column: (ifaceMatch.index || 0) + 1, endLine: lineNum, filePath });
      }

      // Types
      const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)\s*=/);
      if (typeMatch) {
        symbols.push({ name: typeMatch[1], kind: "type", line: lineNum, column: (typeMatch.index || 0) + 1, endLine: lineNum, filePath });
      }

      // Classes
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: "class", line: lineNum, column: (classMatch.index || 0) + 1, endLine: lineNum, filePath });
      }

      // Enums
      const enumMatch = line.match(/(?:export\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({ name: enumMatch[1], kind: "enum", line: lineNum, column: (enumMatch.index || 0) + 1, endLine: lineNum, filePath });
      }

      // React components (const X = () => or function X())
      const componentMatch = line.match(/(?:export\s+)?(?:default\s+)?(?:function|const)\s+([A-Z]\w+)/);
      if (componentMatch && !symbols.find((s) => s.name === componentMatch[1])) {
        symbols.push({ name: componentMatch[1], kind: "function", line: lineNum, column: (componentMatch.index || 0) + 1, endLine: lineNum, filePath, detail: "React Component" });
      }
    }

    if (language === "python") {
      const defMatch = line.match(/(?:async\s+)?def\s+(\w+)/);
      if (defMatch) {
        symbols.push({ name: defMatch[1], kind: "function", line: lineNum, column: (defMatch.index || 0) + 1, endLine: lineNum, filePath });
      }
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: "class", line: lineNum, column: (classMatch.index || 0) + 1, endLine: lineNum, filePath });
      }
    }

    if (language === "rust") {
      const fnMatch = line.match(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: "function", line: lineNum, column: (fnMatch.index || 0) + 1, endLine: lineNum, filePath });
      }
      const structMatch = line.match(/(?:pub\s+)?struct\s+(\w+)/);
      if (structMatch) {
        symbols.push({ name: structMatch[1], kind: "class", line: lineNum, column: (structMatch.index || 0) + 1, endLine: lineNum, filePath });
      }
      const implMatch = line.match(/impl\s+(\w+)/);
      if (implMatch) {
        symbols.push({ name: implMatch[1], kind: "namespace", line: lineNum, column: (implMatch.index || 0) + 1, endLine: lineNum, filePath, detail: "impl" });
      }
    }
  }

  return symbols;
}

function getLanguageFromExtension(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescriptreact", ".js": "javascript", ".jsx": "javascriptreact",
    ".py": "python", ".rs": "rust", ".go": "go", ".css": "css", ".html": "html",
    ".json": "json", ".md": "markdown", ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml", ".sh": "shell", ".bash": "shell",
  };
  return map[ext] || "plaintext";
}

// ─── Codebase Index ─────────────────────────────────────────────────

export class CodebaseIndex {
  private files: Map<string, IndexedFile> = new Map();
  private _stats: IndexStats = {
    totalFiles: 0, totalSymbols: 0, totalLines: 0,
    indexedAt: 0, indexDurationMs: 0, languages: {},
  };

  get stats(): IndexStats {
    return this._stats;
  }

  // ─── Indexing ─────────────────────────────────────────────────────

  indexFile(path: string, content: string): void {
    const name = path.split("/").pop() || path;
    const ext = "." + name.split(".").pop();
    const language = getLanguageFromExtension(ext);
    const symbols = extractSymbols(content, path, language);
    const trigrams = extractTrigrams(name + " " + content.slice(0, 2000));
    const lines = content.split("\n").length;

    this.files.set(path, {
      path,
      relativePath: path,
      name,
      extension: ext,
      size: content.length,
      lastModified: Date.now(),
      symbols,
      trigrams,
      lines,
    });

    this.rebuildStats();
  }

  removeFile(path: string): void {
    this.files.delete(path);
    this.rebuildStats();
  }

  indexBatch(files: Array<{ path: string; content: string }>): void {
    const start = performance.now();
    for (const file of files) {
      this.indexFile(file.path, file.content);
    }
    this._stats.indexDurationMs = performance.now() - start;
    this._stats.indexedAt = Date.now();
  }

  private rebuildStats(): void {
    const languages: Record<string, number> = {};
    let totalSymbols = 0;
    let totalLines = 0;

    for (const file of Array.from(this.files.values())) {
      const lang = getLanguageFromExtension(file.extension);
      languages[lang] = (languages[lang] || 0) + 1;
      totalSymbols += file.symbols.length;
      totalLines += file.lines;
    }

    this._stats = {
      ...this._stats,
      totalFiles: this.files.size,
      totalSymbols,
      totalLines,
      languages,
    };
  }

  // ─── Search ───────────────────────────────────────────────────────

  searchFiles(query: string, limit = 20): SearchResult[] {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const queryTrigrams = extractTrigrams(query);
    const results: SearchResult[] = [];

    for (const file of Array.from(this.files.values())) {
      // Exact name match
      const nameScore = file.name.toLowerCase().includes(queryLower) ? 100 : 0;
      // Fuzzy trigram match
      const trigramScore = trigramSimilarity(queryTrigrams, file.trigrams) * 50;
      // Path match
      const pathScore = file.path.toLowerCase().includes(queryLower) ? 30 : 0;

      const totalScore = nameScore + trigramScore + pathScore;

      if (totalScore > 10) {
        results.push({
          type: "file",
          path: file.path,
          name: file.name,
          detail: file.relativePath,
          matchScore: totalScore,
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
  }

  searchSymbols(query: string, limit = 20): SearchResult[] {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const file of Array.from(this.files.values())) {
      for (const symbol of file.symbols) {
        const nameLower = symbol.name.toLowerCase();
        let score = 0;

        // Exact match
        if (nameLower === queryLower) score = 100;
        // Prefix match
        else if (nameLower.startsWith(queryLower)) score = 80;
        // Contains match
        else if (nameLower.includes(queryLower)) score = 50;
        // Fuzzy match (initials)
        else {
          const initials = symbol.name.replace(/[a-z]/g, "").toLowerCase();
          if (initials.includes(queryLower)) score = 30;
        }

        if (score > 0) {
          results.push({
            type: "symbol",
            path: file.path,
            name: symbol.name,
            detail: `${symbol.kind} in ${file.name}`,
            line: symbol.line,
            column: symbol.column,
            matchScore: score,
          });
        }
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
  }

  searchContent(query: string, limit = 50): SearchResult[] {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    // This would be a full-text search in production (ripgrep via Tauri)
    // In web prototype, we search indexed trigrams only
    const queryTrigrams = extractTrigrams(query);

    for (const file of Array.from(this.files.values())) {
      const score = trigramSimilarity(queryTrigrams, file.trigrams);
      if (score > 0.3) {
        results.push({
          type: "content",
          path: file.path,
          name: file.name,
          detail: `Match in ${file.name}`,
          matchScore: score * 100,
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
  }

  // ─── Combined Search ──────────────────────────────────────────────

  search(query: string, limit = 30): SearchResult[] {
    const files = this.searchFiles(query, 10);
    const symbols = this.searchSymbols(query, 10);
    const content = this.searchContent(query, 10);

    return [...files, ...symbols, ...content]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  // ─── Getters ──────────────────────────────────────────────────────

  getFile(path: string): IndexedFile | undefined {
    return this.files.get(path);
  }

  getAllFiles(): IndexedFile[] {
    return Array.from(this.files.values());
  }

  getSymbolsForFile(path: string): CodeSymbol[] {
    return this.files.get(path)?.symbols || [];
  }
}

// Singleton
export const codebaseIndex = new CodebaseIndex();
