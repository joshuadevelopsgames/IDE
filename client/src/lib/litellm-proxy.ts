/*
 * Obsidian Forge — LiteLLM Multi-Model Proxy
 *
 * Manages configuration for a local LiteLLM proxy sidecar that normalizes
 * all LLM provider APIs into a single OpenAI-compatible interface.
 *
 * Integration path:
 *   Repo: https://github.com/BerriAI/litellm (40.3k stars)
 *   Install: pip install litellm[proxy]
 *   Run: litellm --model gpt-4 --port 4000
 *
 * Architecture:
 *   Settings UI → LiteLLMConfig → Tauri spawns litellm proxy → Hermes calls localhost:4000
 *   Users pick model + provider in Settings; LiteLLM handles routing.
 */

// ─── Model Definitions ──────────────────────────────────────────────

export interface ModelProvider {
  id: string;
  name: string;
  description: string;
  models: ModelDef[];
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  baseUrl?: string;
}

export interface ModelDef {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  costPer1kInput?: number;   // USD
  costPer1kOutput?: number;  // USD
  supportsVision: boolean;
  supportsTools: boolean;
}

export interface LiteLLMConfig {
  proxyPort: number;
  selectedProviderId: string;
  selectedModelId: string;
  apiKeys: Record<string, string>;  // providerId → key
  customEndpoint?: string;
}

// ─── Provider Registry ──────────────────────────────────────────────

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: "nous",
    name: "Nous Research",
    description: "Hermes models via Nous Portal",
    requiresApiKey: true,
    apiKeyEnvVar: "NOUS_API_KEY",
    baseUrl: "https://inference.nous.hermes.dev/v1",
    models: [
      { id: "nous/hermes-3-llama-3.1-70b", name: "Hermes 3 (70B)", contextWindow: 131072, maxOutput: 8192, supportsVision: false, supportsTools: true },
      { id: "nous/hermes-3-llama-3.1-8b", name: "Hermes 3 (8B)", contextWindow: 131072, maxOutput: 8192, supportsVision: false, supportsTools: true },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4, GPT-4o, o1, o3 models",
    requiresApiKey: true,
    apiKeyEnvVar: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1047576, maxOutput: 32768, costPer1kInput: 0.002, costPer1kOutput: 0.008, supportsVision: true, supportsTools: true },
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutput: 16384, costPer1kInput: 0.0025, costPer1kOutput: 0.01, supportsVision: true, supportsTools: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, maxOutput: 16384, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, supportsVision: true, supportsTools: true },
      { id: "o3-mini", name: "o3-mini", contextWindow: 200000, maxOutput: 100000, costPer1kInput: 0.0011, costPer1kOutput: 0.0044, supportsVision: false, supportsTools: true },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 4 Sonnet, Claude 3.5 models",
    requiresApiKey: true,
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-4-sonnet", name: "Claude 4 Sonnet", contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015, supportsVision: true, supportsTools: true },
      { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015, supportsVision: true, supportsTools: true },
      { id: "claude-3.5-haiku", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.0008, costPer1kOutput: 0.004, supportsVision: true, supportsTools: true },
    ],
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini 2.5 Pro, Flash models",
    requiresApiKey: true,
    apiKeyEnvVar: "GOOGLE_API_KEY",
    models: [
      { id: "gemini/gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, maxOutput: 65536, costPer1kInput: 0.00125, costPer1kOutput: 0.01, supportsVision: true, supportsTools: true },
      { id: "gemini/gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, maxOutput: 65536, costPer1kInput: 0.000075, costPer1kOutput: 0.0003, supportsVision: true, supportsTools: true },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference for open models",
    requiresApiKey: true,
    apiKeyEnvVar: "GROQ_API_KEY",
    models: [
      { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 131072, maxOutput: 32768, costPer1kInput: 0.00059, costPer1kOutput: 0.00079, supportsVision: false, supportsTools: true },
      { id: "groq/llama-3.1-8b-instant", name: "Llama 3.1 8B", contextWindow: 131072, maxOutput: 8192, costPer1kInput: 0.00005, costPer1kOutput: 0.00008, supportsVision: false, supportsTools: true },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 200+ models through one API",
    requiresApiKey: true,
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "openrouter/auto", name: "Auto (best available)", contextWindow: 128000, maxOutput: 16384, supportsVision: true, supportsTools: true },
    ],
  },
  {
    id: "local",
    name: "Local / Ollama",
    description: "Self-hosted models via Ollama or vLLM",
    requiresApiKey: false,
    apiKeyEnvVar: "",
    baseUrl: "http://localhost:11434/v1",
    models: [
      { id: "ollama/hermes3", name: "Hermes 3 (local)", contextWindow: 131072, maxOutput: 8192, supportsVision: false, supportsTools: true },
      { id: "ollama/codellama", name: "Code Llama (local)", contextWindow: 16384, maxOutput: 4096, supportsVision: false, supportsTools: false },
      { id: "ollama/deepseek-coder-v2", name: "DeepSeek Coder V2 (local)", contextWindow: 131072, maxOutput: 8192, supportsVision: false, supportsTools: true },
    ],
  },
  {
    id: "custom",
    name: "Custom Endpoint",
    description: "Any OpenAI-compatible API endpoint",
    requiresApiKey: true,
    apiKeyEnvVar: "CUSTOM_API_KEY",
    models: [
      { id: "custom/model", name: "Custom Model", contextWindow: 128000, maxOutput: 16384, supportsVision: false, supportsTools: true },
    ],
  },
];

// ─── Config Helpers ─────────────────────────────────────────────────

export function getDefaultConfig(): LiteLLMConfig {
  return {
    proxyPort: 4000,
    selectedProviderId: "nous",
    selectedModelId: "nous/hermes-3-llama-3.1-70b",
    apiKeys: {},
  };
}

export function getProvider(providerId: string): ModelProvider | undefined {
  return MODEL_PROVIDERS.find((p) => p.id === providerId);
}

export function getModel(modelId: string): ModelDef | undefined {
  for (const provider of MODEL_PROVIDERS) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model;
  }
  return undefined;
}

export function getProviderForModel(modelId: string): ModelProvider | undefined {
  return MODEL_PROVIDERS.find((p) => p.models.some((m) => m.id === modelId));
}

/**
 * Generate the LiteLLM YAML config that would be written to disk
 * for the proxy sidecar to consume.
 */
export function generateLiteLLMConfig(config: LiteLLMConfig): string {
  const provider = getProvider(config.selectedProviderId);
  const model = getModel(config.selectedModelId);

  if (!provider || !model) return "";

  const lines: string[] = [
    "model_list:",
    `  - model_name: ${model.name}`,
    `    litellm_params:`,
    `      model: ${config.selectedModelId}`,
  ];

  if (provider.baseUrl || config.customEndpoint) {
    lines.push(`      api_base: ${config.customEndpoint || provider.baseUrl}`);
  }

  if (provider.requiresApiKey && config.apiKeys[provider.id]) {
    lines.push(`      api_key: os.environ/${provider.apiKeyEnvVar}`);
  }

  lines.push("");
  lines.push("general_settings:");
  lines.push("  master_key: sk-dream-ide-local");
  lines.push(`  port: ${config.proxyPort}`);

  return lines.join("\n");
}

/**
 * Generate environment variables for the LiteLLM proxy process.
 */
export function generateEnvVars(config: LiteLLMConfig): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [providerId, key] of Object.entries(config.apiKeys)) {
    const provider = getProvider(providerId);
    if (provider && key) {
      env[provider.apiKeyEnvVar] = key;
    }
  }

  return env;
}
