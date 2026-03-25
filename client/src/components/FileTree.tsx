/*
 * Obsidian Forge — File Tree
 * Industrial precision: compact rows, hard edges, amber highlights on selection.
 * Monospace file names, muted icons, no decorative padding.
 */
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { useIDEStore, type FileNode } from "@/lib/store";
import { DEMO_FILE_CONTENTS } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", css: "css", html: "html", md: "markdown", py: "python",
    rs: "rust", go: "go", yaml: "yaml", yml: "yaml", toml: "toml",
    sh: "shell", bash: "shell", txt: "plaintext",
  };
  return map[ext] || "plaintext";
}

function FileIcon({ node }: { node: FileNode }) {
  const ext = node.name.split(".").pop()?.toLowerCase() || "";
  const colorMap: Record<string, string> = {
    tsx: "text-blue-400", ts: "text-blue-400", jsx: "text-yellow-400",
    js: "text-yellow-400", json: "text-green-400", css: "text-pink-400",
    html: "text-orange-400", md: "text-muted-foreground", py: "text-green-300",
    rs: "text-orange-300",
  };
  return <File className={cn("w-3.5 h-3.5 shrink-0", colorMap[ext] || "text-muted-foreground")} />;
}

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { toggleFolder, selectedFile, setSelectedFile, openFile, tabs } = useIDEStore();

  const handleClick = () => {
    if (node.type === "directory") {
      toggleFolder(node.path);
    } else {
      setSelectedFile(node.path);
      const existing = tabs.find((t) => t.path === node.path);
      if (!existing) {
        const demo = DEMO_FILE_CONTENTS[node.path];
        openFile({
          id: crypto.randomUUID(),
          path: node.path,
          name: node.name,
          language: getLanguageFromPath(node.path),
          content: demo?.content || `// ${node.name}\n`,
          isDirty: false,
        });
      } else {
        useIDEStore.getState().setActiveTab(existing.id);
      }
    }
  };

  const isSelected = selectedFile === node.path;
  const isDir = node.type === "directory";

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center w-full gap-1 py-[3px] pr-2 text-[12px] font-mono-code",
          "hover:bg-forge-surface-raised transition-colors duration-100",
          isSelected && "bg-forge-surface-raised text-forge-amber",
          !isSelected && "text-sidebar-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {node.expanded ? (
              <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
            )}
            {node.expanded ? (
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-forge-amber-dim" />
            ) : (
              <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileIcon node={node} />
          </>
        )}
        <span className="truncate ml-1">{node.name}</span>
      </button>
      {isDir && node.expanded && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function FileTree() {
  const { fileTree } = useIDEStore();

  return (
    <div className="h-full overflow-y-auto bg-sidebar py-1 select-none">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Explorer
      </div>
      {fileTree.map((node) => (
        <TreeNode key={node.path} node={node} />
      ))}
    </div>
  );
}
