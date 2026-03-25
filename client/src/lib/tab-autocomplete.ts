/*
 * Obsidian Forge — Tab Autocomplete Engine
 *
 * Provides inline ghost-text completions in the Monaco editor,
 * similar to Cursor's Tab feature or GitHub Copilot.
 *
 * Integration path:
 *   Repo: https://github.com/TabbyML/tabby (33k stars)
 *   Tabby exposes a REST API: POST /v1/completions
 *   Or use any OpenAI-compatible completions endpoint.
 *
 * Architecture:
 *   Monaco InlineCompletionsProvider → debounce → POST to Tabby/LiteLLM → ghost text
 *   The provider registers with Monaco and shows suggestions on every keystroke.
 *   User presses Tab to accept, Escape to dismiss.
 */

import type * as Monaco from "monaco-editor";

// ─── Types ──────────────────────────────────────────────────────────

export interface AutocompleteConfig {
  enabled: boolean;
  endpoint: string;           // e.g. "http://localhost:8080/v1/completions" (Tabby)
  apiKey?: string;
  debounceMs: number;         // default: 300
  maxSuggestionLines: number; // default: 6
  temperature: number;        // default: 0.2
  model?: string;             // for OpenAI-compatible endpoints
}

export interface CompletionRequest {
  prompt: string;
  suffix?: string;
  language: string;
  maxTokens: number;
  temperature: number;
  stop?: string[];
}

export interface CompletionResponse {
  id: string;
  text: string;
  finishReason: "stop" | "length";
}

// ─── Default Config ─────────────────────────────────────────────────

export function getDefaultAutocompleteConfig(): AutocompleteConfig {
  return {
    enabled: true,
    endpoint: "http://localhost:8080/v1/completions",
    debounceMs: 300,
    maxSuggestionLines: 6,
    temperature: 0.2,
  };
}

// ─── Completion Client ──────────────────────────────────────────────

export class CompletionClient {
  private config: AutocompleteConfig;
  private abortController: AbortController | null = null;
  private cache: Map<string, string> = new Map();
  private cacheMaxSize = 100;

  constructor(config: AutocompleteConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<AutocompleteConfig>): void {
    Object.assign(this.config, config);
  }

  async getCompletion(request: CompletionRequest): Promise<CompletionResponse | null> {
    if (!this.config.enabled) return null;

    // Check cache
    const cacheKey = `${request.language}:${request.prompt.slice(-200)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { id: "cached", text: cached, finishReason: "stop" };
    }

    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model || "default",
          prompt: request.prompt,
          suffix: request.suffix,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          stop: request.stop || ["\n\n", "```"],
          stream: false,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) return null;

      const data = await response.json();
      const text = data.choices?.[0]?.text || data.text || "";

      if (text.trim()) {
        // Cache the result
        if (this.cache.size >= this.cacheMaxSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, text);
      }

      return {
        id: data.id || crypto.randomUUID(),
        text,
        finishReason: data.choices?.[0]?.finish_reason || "stop",
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null; // Cancelled — expected
      }
      // Silently fail for network errors (Tabby might not be running)
      return null;
    }
  }

  // ─── Simulation (Web Prototype) ──────────────────────────────────

  async getSimulatedCompletion(request: CompletionRequest): Promise<CompletionResponse | null> {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));

    const suggestions = this.getContextualSuggestion(request);
    if (!suggestions) return null;

    return {
      id: crypto.randomUUID(),
      text: suggestions,
      finishReason: "stop",
    };
  }

  private getContextualSuggestion(request: CompletionRequest): string | null {
    const lastLine = request.prompt.split("\n").pop() || "";
    const trimmed = lastLine.trim();

    // TypeScript/JavaScript suggestions
    if (request.language === "typescript" || request.language === "javascript" || request.language === "typescriptreact") {
      if (trimmed.startsWith("const ") && trimmed.includes("=")) return null;
      if (trimmed.startsWith("function ")) return " {\n  \n}";
      if (trimmed.startsWith("if (")) return " {\n  \n}";
      if (trimmed.startsWith("for (")) return " {\n  \n}";
      if (trimmed.endsWith("=> ")) return "{\n  \n}";
      if (trimmed.startsWith("import ")) return ` from "";`;
      if (trimmed.startsWith("export ")) return "default function Component() {\n  return (\n    <div>\n      \n    </div>\n  );\n}";
      if (trimmed.startsWith("console.")) return `log();`;
      if (trimmed.startsWith("async ")) return "function () {\n  try {\n    \n  } catch (error) {\n    console.error(error);\n  }\n}";
      if (trimmed.startsWith("interface ")) return " {\n  id: string;\n  name: string;\n}";
      if (trimmed.startsWith("type ")) return " = {\n  \n};";
      if (trimmed === "use") return "Effect(() => {\n  \n  return () => {\n    // cleanup\n  };\n}, []);";
      if (trimmed === "use") return "State()";
    }

    // Python suggestions
    if (request.language === "python") {
      if (trimmed.startsWith("def ")) return ":\n    pass";
      if (trimmed.startsWith("class ")) return ":\n    def __init__(self):\n        pass";
      if (trimmed.startsWith("if ")) return ":\n    pass";
      if (trimmed.startsWith("for ")) return ":\n    pass";
      if (trimmed.startsWith("import ")) return "";
      if (trimmed.startsWith("async def ")) return ":\n    pass";
    }

    // Rust suggestions
    if (request.language === "rust") {
      if (trimmed.startsWith("fn ")) return " -> Result<(), Box<dyn std::error::Error>> {\n    Ok(())\n}";
      if (trimmed.startsWith("struct ")) return " {\n    \n}";
      if (trimmed.startsWith("impl ")) return " {\n    \n}";
      if (trimmed.startsWith("let ")) return "";
      if (trimmed.startsWith("match ")) return " {\n    _ => {}\n}";
    }

    return null;
  }
}

// ─── Monaco Inline Completions Provider ─────────────────────────────

export function createInlineCompletionsProvider(
  client: CompletionClient,
  config: AutocompleteConfig
): Monaco.languages.InlineCompletionsProvider {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    provideInlineCompletions: async (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _context: Monaco.languages.InlineCompletionContext,
      token: Monaco.CancellationToken
    ): Promise<Monaco.languages.InlineCompletions> => {
      if (!config.enabled) return { items: [] };

      // Debounce
      if (debounceTimer) clearTimeout(debounceTimer);

      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          // Build prompt from editor content
          const textBefore = model.getValueInRange({
            startLineNumber: Math.max(1, position.lineNumber - 50),
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const textAfter = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 10),
            endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 10)),
          });

          const language = model.getLanguageId();

          // Use simulated completions in web prototype
          const result = await client.getSimulatedCompletion({
            prompt: textBefore,
            suffix: textAfter,
            language,
            maxTokens: config.maxSuggestionLines * 40,
            temperature: config.temperature,
          });

          if (!result || !result.text || token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          resolve({
            items: [
              {
                insertText: result.text,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              },
            ],
          });
        }, config.debounceMs);
      });
    },

    disposeInlineCompletions: () => {
      // Cleanup
    },
  };
}

// Singleton client
export const completionClient = new CompletionClient(getDefaultAutocompleteConfig());
