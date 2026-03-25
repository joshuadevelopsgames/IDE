/*
 * Obsidian Forge — MCP Server Manager UI
 * Manages MCP server connections: add, remove, connect, disconnect, view tools.
 */
import { useState } from "react";
import { useMCPServers, type MCPServerConfig, type MCPServerState, MCPClientManager } from "@/lib/mcp-client";
import { cn } from "@/lib/utils";
import {
  Plug, PlugZap, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Wrench, Globe, FileText, AlertCircle, Check, Loader2, Settings
} from "lucide-react";

function StatusBadge({ status }: { status: MCPServerState["status"] }) {
  const config = {
    disconnected: { color: "bg-muted-foreground/30", label: "Disconnected" },
    connecting: { color: "bg-forge-amber animate-pulse", label: "Connecting..." },
    connected: { color: "bg-forge-teal", label: "Connected" },
    error: { color: "bg-forge-coral", label: "Error" },
  };
  const c = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", c.color)} />
      <span className="text-[10px] text-muted-foreground">{c.label}</span>
    </div>
  );
}

function ServerCard({ server, onConnect, onDisconnect, onRemove }: {
  server: MCPServerState;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded bg-forge-surface-raised">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Plug className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-[12px] font-medium text-foreground truncate">{server.config.name}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 truncate ml-5.5">
            {server.config.description}
          </p>
        </div>

        <StatusBadge status={server.status} />

        <div className="flex items-center gap-1 shrink-0">
          {server.status === "connected" ? (
            <button
              onClick={onDisconnect}
              className="p-1 text-muted-foreground/40 hover:text-forge-coral transition-colors"
              title="Disconnect"
            >
              <PlugZap className="w-3.5 h-3.5" />
            </button>
          ) : server.status === "connecting" ? (
            <Loader2 className="w-3.5 h-3.5 text-forge-amber animate-spin" />
          ) : (
            <button
              onClick={onConnect}
              className="p-1 text-muted-foreground/40 hover:text-forge-teal transition-colors"
              title="Connect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1 text-muted-foreground/40 hover:text-forge-coral transition-colors"
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {/* Transport info */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span className="px-1.5 py-0.5 bg-forge-surface-overlay rounded text-[9px] font-mono-code">
              {server.config.transport}
            </span>
            {server.config.command && (
              <span className="font-mono-code truncate">
                {server.config.command} {server.config.args?.join(" ")}
              </span>
            )}
          </div>

          {/* Tools */}
          {server.tools.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                <Wrench className="w-2.5 h-2.5" />
                Tools ({server.tools.length})
              </div>
              <div className="space-y-0.5 pl-3.5">
                {server.tools.map((tool) => (
                  <div key={tool.name} className="flex items-start gap-1.5">
                    <span className="text-[11px] font-mono-code text-forge-amber">{tool.name}</span>
                    <span className="text-[10px] text-muted-foreground/40 truncate">{tool.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {server.error && (
            <div className="flex items-start gap-1.5 text-[10px] text-forge-coral">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{server.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddServerForm({ onAdd, onCancel }: {
  onAdd: (config: MCPServerConfig) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name || !command) return;
    onAdd({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      description: description || `Custom MCP server: ${name}`,
      transport: "stdio",
      command,
      args: args.split(/\s+/).filter(Boolean),
      enabled: true,
      autoStart: false,
    });
  };

  return (
    <div className="border border-forge-amber/30 rounded bg-forge-surface-raised p-3 space-y-2">
      <div className="text-[11px] font-semibold text-forge-amber">Add MCP Server</div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Server name"
        className="w-full bg-forge-surface border border-border rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-forge-amber/50 focus:outline-none"
      />
      <input
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder="Command (e.g., npx @playwright/mcp)"
        className="w-full bg-forge-surface border border-border rounded px-2 py-1 text-[11px] text-foreground font-mono-code placeholder:text-muted-foreground/30 focus:border-forge-amber/50 focus:outline-none"
      />
      <input
        value={args}
        onChange={(e) => setArgs(e.target.value)}
        placeholder="Arguments (space-separated)"
        className="w-full bg-forge-surface border border-border rounded px-2 py-1 text-[11px] text-foreground font-mono-code placeholder:text-muted-foreground/30 focus:border-forge-amber/50 focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full bg-forge-surface border border-border rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-forge-amber/50 focus:outline-none"
      />

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name || !command}
          className="px-3 py-1 text-[10px] rounded bg-forge-amber/15 text-forge-amber hover:bg-forge-amber/25 transition-colors disabled:opacity-30"
        >
          Add Server
        </button>
      </div>
    </div>
  );
}

export default function MCPManager() {
  const { servers, addServer, removeServer, connectServer, disconnectServer } = useMCPServers();
  const [showAddForm, setShowAddForm] = useState(false);

  const connectedCount = servers.filter((s) => s.status === "connected").length;
  const totalTools = servers.reduce((acc, s) => acc + s.tools.length, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            MCP Servers
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
          <span>{connectedCount} connected</span>
          <span>·</span>
          <span>{totalTools} tools</span>
        </div>
      </div>

      {/* Server list */}
      <div className="space-y-2">
        {servers.map((server) => (
          <ServerCard
            key={server.config.id}
            server={server}
            onConnect={() => connectServer(server.config.id)}
            onDisconnect={() => disconnectServer(server.config.id)}
            onRemove={() => removeServer(server.config.id)}
          />
        ))}
      </div>

      {/* Add server */}
      {showAddForm ? (
        <AddServerForm
          onAdd={(config) => {
            addServer(config);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground border border-dashed border-border rounded hover:border-forge-amber/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add MCP Server
        </button>
      )}

      {/* Quick-add presets */}
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground/30 font-semibold uppercase tracking-wider">
          Popular Servers
        </div>
        {MCPClientManager.DEFAULT_SERVERS
          .filter((s) => !servers.find((existing) => existing.config.id === s.id))
          .map((preset) => (
            <button
              key={preset.id}
              onClick={() => addServer(preset)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground rounded hover:bg-forge-surface-raised transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{preset.name}</span>
              <span className="text-[9px] text-muted-foreground/30 ml-auto">{preset.description}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
