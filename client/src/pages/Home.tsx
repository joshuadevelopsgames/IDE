/*
 * Obsidian Forge — Home / Project Picker
 * Hero with forge background, recent projects grid, open folder action.
 */
import { FolderOpen, Clock, ChevronRight, Plus, Zap } from "lucide-react";
import { useIDEStore } from "@/lib/store";
import { DEMO_FILE_TREE } from "@/lib/demo-data";

import { cn } from "@/lib/utils";

export default function Home() {
  const { recentProjects, openProject, setFileTree } = useIDEStore();

  const handleOpenProject = (project: { name: string; path: string; lastOpened: number }) => {
    setFileTree(DEMO_FILE_TREE);
    // Open project and default to the unified agent chat panel
    useIDEStore.setState({ rightPanel: "chat" });
    openProject(project);
  };

  const handleOpenFolder = () => {
    // In Tauri, this would invoke a native file dialog
    handleOpenProject({
      name: "new-project",
      path: "/Users/dev/projects/new-project",
      lastOpened: Date.now(),
    });
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero section */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663334932816/NySiUCnVhDhjqciPuE4bRd/hero-forge-bg-HkvyAGhsQomfesM8LrDzNe.webp)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663334932816/NySiUCnVhDhjqciPuE4bRd/agent-avatar-SXWBPzjYmAUnkgKGXLrf7U.webp"
              alt="Dream IDE"
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Dream IDE
              </h1>
              <p className="text-[11px] text-muted-foreground/60">
                Powered by Hermes Agent
              </p>
            </div>
          </div>

          <p className="text-[14px] text-foreground/70 max-w-md leading-relaxed mb-8">
            Your AI-native development environment. Open a project to start building with an intelligent agent that understands your codebase.
          </p>

          {/* Quick actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 px-4 py-2.5 bg-forge-amber text-forge-gutter text-[13px] font-semibold rounded hover:bg-forge-amber/90 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 px-4 py-2.5 bg-forge-surface-raised text-foreground/80 text-[13px] font-medium rounded border border-border hover:bg-forge-surface-overlay hover:border-forge-amber/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="flex-1 max-w-3xl mx-auto px-6 pb-12 w-full">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
            Recent Projects
          </h2>
        </div>

        <div className="space-y-1">
          {recentProjects.map((project) => (
            <button
              key={project.path}
              onClick={() => handleOpenProject(project)}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-forge-surface-raised transition-colors group text-left"
            >
              <div className="w-9 h-9 rounded bg-forge-surface-overlay flex items-center justify-center shrink-0 group-hover:bg-forge-amber/10 transition-colors">
                <FolderOpen className="w-4 h-4 text-muted-foreground group-hover:text-forge-amber transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground group-hover:text-forge-amber transition-colors">
                  {project.name}
                </p>
                <p className="text-[11px] text-muted-foreground/40 font-mono-code truncate">
                  {project.path}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground/30">{timeAgo(project.lastOpened)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-forge-amber/50 transition-colors" />
              </div>
            </button>
          ))}
        </div>

        {/* Hermes status */}
        <div className="mt-8 p-4 rounded-lg bg-forge-surface-raised border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-forge-amber/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-forge-amber" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-medium text-foreground">Hermes Agent Ready</p>
              <p className="text-[10px] text-muted-foreground/50">
                Configure your model provider in Settings to get started
              </p>
            </div>
            <button
              onClick={() => {
                handleOpenProject(recentProjects[0]);
                setTimeout(() => useIDEStore.getState().setRightPanel("settings"), 100);
              }}
              className="text-[11px] text-forge-amber hover:text-forge-amber/80 font-medium transition-colors"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/25 font-mono-code">Dream IDE v1.0.0</span>
          <span className="text-[10px] text-muted-foreground/25 font-mono-code">Ctrl+K for commands</span>
        </div>
      </div>
    </div>
  );
}
