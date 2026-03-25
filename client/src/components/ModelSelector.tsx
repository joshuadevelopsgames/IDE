/*
 * Obsidian Forge — Model Selector
 * Visual model picker with provider groups, model details, and API key management.
 */
import { useState } from "react";
import { MODEL_PROVIDERS, type ModelProvider, type ModelDef, getProvider } from "@/lib/litellm-proxy";
import { useIDEStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Cpu, Eye, EyeOff, Wrench, Zap, Globe, Server, Key,
  ChevronDown, ChevronRight, Check, ExternalLink
} from "lucide-react";

function ProviderIcon({ id }: { id: string }) {
  const iconMap: Record<string, string> = {
    nous: "🔥",
    openai: "◻",
    anthropic: "◈",
    google: "◆",
    groq: "⚡",
    openrouter: "🔀",
    local: "🖥",
    custom: "⚙",
  };
  return <span className="text-[14px]">{iconMap[id] || "●"}</span>;
}

function ModelCard({ model, provider, isSelected, onSelect }: {
  model: ModelDef;
  provider: ModelProvider;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2 rounded border transition-all",
        isSelected
          ? "border-forge-amber/50 bg-forge-amber/5"
          : "border-border hover:border-forge-amber/20 bg-forge-surface-raised"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSelected && <Check className="w-3 h-3 text-forge-amber" />}
          <span className="text-[12px] font-medium text-foreground">{model.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {model.supportsVision && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-forge-teal/15 text-forge-teal font-semibold">
              VISION
            </span>
          )}
          {model.supportsTools && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-forge-amber/15 text-forge-amber font-semibold">
              TOOLS
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
        <span>{(model.contextWindow / 1000).toFixed(0)}k ctx</span>
        <span>{(model.maxOutput / 1000).toFixed(0)}k out</span>
        {model.costPer1kInput !== undefined && (
          <span>${model.costPer1kInput}/1k in</span>
        )}
      </div>
    </button>
  );
}

function ProviderGroup({ provider, selectedModelId, onSelectModel, apiKey, onApiKeyChange }: {
  provider: ModelProvider;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(
    provider.models.some((m) => m.id === selectedModelId)
  );
  const [showKey, setShowKey] = useState(false);
  const hasSelectedModel = provider.models.some((m) => m.id === selectedModelId);

  return (
    <div className={cn(
      "border rounded transition-colors",
      hasSelectedModel ? "border-forge-amber/30" : "border-border"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-forge-surface-raised/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
        <ProviderIcon id={provider.id} />
        <div className="flex-1 text-left">
          <span className="text-[12px] font-medium text-foreground">{provider.name}</span>
          <span className="text-[10px] text-muted-foreground/40 ml-2">{provider.description}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/30">{provider.models.length} models</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {/* API Key */}
          {provider.requiresApiKey && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Key className="w-2.5 h-2.5" />
                <span>{provider.apiKeyEnvVar}</span>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder={`Enter ${provider.name} API key...`}
                  className="w-full bg-forge-surface border border-border rounded px-2 py-1 text-[11px] text-foreground font-mono-code placeholder:text-muted-foreground/20 focus:border-forge-amber/50 focus:outline-none pr-7"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground"
                >
                  {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}

          {/* Custom endpoint */}
          {provider.baseUrl && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30 font-mono-code">
              <Globe className="w-2.5 h-2.5" />
              {provider.baseUrl}
            </div>
          )}

          {/* Models */}
          <div className="space-y-1">
            {provider.models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                provider={provider}
                isSelected={model.id === selectedModelId}
                onSelect={() => onSelectModel(model.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelSelector() {
  const { settings, updateSettings } = useIDEStore();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const handleSelectModel = (modelId: string) => {
    const provider = MODEL_PROVIDERS.find((p) => p.models.some((m) => m.id === modelId));
    if (provider) {
      updateSettings({
        modelProvider: provider.id,
        selectedModelId: modelId,
      });
    }
  };

  const handleApiKeyChange = (providerId: string, key: string) => {
    setApiKeys((prev) => ({ ...prev, [providerId]: key }));
    // In production, this would be saved to OS keychain via Tauri
    if (providerId === settings.modelProvider) {
      updateSettings({ apiKey: key });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Model Provider
        </span>
      </div>

      {/* Current selection summary */}
      {settings.selectedModelId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-forge-amber/5 border border-forge-amber/20">
          <Check className="w-3 h-3 text-forge-amber" />
          <span className="text-[11px] text-foreground">
            {MODEL_PROVIDERS.flatMap((p) => p.models).find((m) => m.id === settings.selectedModelId)?.name || settings.selectedModelId}
          </span>
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            via {getProvider(settings.modelProvider)?.name}
          </span>
        </div>
      )}

      {/* Provider list */}
      <div className="space-y-2">
        {MODEL_PROVIDERS.map((provider) => (
          <ProviderGroup
            key={provider.id}
            provider={provider}
            selectedModelId={settings.selectedModelId || ""}
            onSelectModel={handleSelectModel}
            apiKey={apiKeys[provider.id] || ""}
            onApiKeyChange={(key) => handleApiKeyChange(provider.id, key)}
          />
        ))}
      </div>
    </div>
  );
}
