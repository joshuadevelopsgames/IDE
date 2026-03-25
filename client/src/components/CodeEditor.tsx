/*
 * Obsidian Forge — Code Editor
 * Monaco editor with dark forge theme, diff view toggle, tab bar with dirty indicators.
 */
import { useCallback, useRef, useEffect, useState } from "react";
import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { X, Circle, GitCompare, Code2 } from "lucide-react";
import { useIDEStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Configure Monaco theme
loader.init().then((monaco) => {
  monaco.editor.defineTheme("obsidian-forge", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5C6370", fontStyle: "italic" },
      { token: "keyword", foreground: "E8A838" },
      { token: "string", foreground: "3AAFA9" },
      { token: "number", foreground: "D19A66" },
      { token: "type", foreground: "61AFEF" },
      { token: "function", foreground: "98C379" },
      { token: "variable", foreground: "E8ECF1" },
      { token: "operator", foreground: "ABB2BF" },
      { token: "delimiter", foreground: "ABB2BF" },
    ],
    colors: {
      "editor.background": "#0F1115",
      "editor.foreground": "#E8ECF1",
      "editor.lineHighlightBackground": "#1A1D24",
      "editor.selectionBackground": "#2C3039",
      "editor.inactiveSelectionBackground": "#22252B",
      "editorCursor.foreground": "#E8A838",
      "editorLineNumber.foreground": "#3D424D",
      "editorLineNumber.activeForeground": "#8892A0",
      "editorIndentGuide.background": "#1E2128",
      "editorIndentGuide.activeBackground": "#2C3039",
      "editor.selectionHighlightBackground": "#2C303950",
      "editorBracketMatch.background": "#2C303980",
      "editorBracketMatch.border": "#E8A83840",
      "editorGutter.background": "#0D0F12",
      "editorWidget.background": "#161A1F",
      "editorWidget.border": "#2A2E36",
      "editorSuggestWidget.background": "#161A1F",
      "editorSuggestWidget.border": "#2A2E36",
      "editorSuggestWidget.selectedBackground": "#2C3039",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#2A2E3660",
      "scrollbarSlider.hoverBackground": "#3D424D80",
      "scrollbarSlider.activeBackground": "#4D535DA0",
      "minimap.background": "#0D0F12",
    },
  });
});

function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useIDEStore();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center bg-forge-gutter border-b border-border overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-mono-code border-r border-border",
              "transition-colors duration-100 shrink-0 group relative",
              isActive
                ? "bg-forge-surface text-foreground"
                : "bg-forge-gutter text-muted-foreground hover:text-foreground hover:bg-forge-surface/50"
            )}
          >
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-forge-amber" />
            )}
            {tab.isDirty && (
              <Circle className="w-2 h-2 fill-forge-amber text-forge-amber shrink-0" />
            )}
            <span className="truncate max-w-[120px]">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="ml-1 p-0.5 rounded hover:bg-forge-surface-overlay opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </button>
        );
      })}
    </div>
  );
}

export default function CodeEditor() {
  const { tabs, activeTabId, updateTabContent } = useIDEStore();
  const [showDiff, setShowDiff] = useState(false);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (activeTabId && value !== undefined) {
        updateTabContent(activeTabId, value);
      }
    },
    [activeTabId, updateTabContent]
  );

  // Keyboard shortcut for diff toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
        e.preventDefault();
        setShowDiff((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col">
        <TabBar />
        <div className="flex-1 flex items-center justify-center bg-forge-surface">
          <div className="text-center space-y-3">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663334932816/NySiUCnVhDhjqciPuE4bRd/empty-state-illustration-jRurXEpKfXucYJ3zbzSw6C.webp"
              alt="Dream IDE"
              className="w-24 h-24 mx-auto opacity-40"
            />
            <p className="text-muted-foreground text-sm">Open a file to start editing</p>
            <p className="text-muted-foreground/50 text-xs font-mono-code">
              Ctrl+P to search files
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasDiff = !!activeTab.originalContent;

  return (
    <div className="flex-1 flex flex-col">
      <TabBar />
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-3 py-1 bg-forge-gutter border-b border-border">
        <span className="text-[11px] text-muted-foreground font-mono-code truncate">
          {activeTab.path}
        </span>
        <div className="flex items-center gap-1">
          {hasDiff && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 text-[11px] rounded transition-colors",
                showDiff
                  ? "bg-forge-amber/20 text-forge-amber"
                  : "text-muted-foreground hover:text-foreground hover:bg-forge-surface-raised"
              )}
            >
              {showDiff ? <GitCompare className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
              {showDiff ? "Diff" : "Code"}
            </button>
          )}
          <span className="text-[10px] text-muted-foreground/60 font-mono-code ml-2">
            {activeTab.language}
          </span>
        </div>
      </div>
      {/* Editor body */}
      <div className="flex-1 relative">
        {showDiff && hasDiff ? (
          <DiffEditor
            original={activeTab.originalContent}
            modified={activeTab.content}
            language={activeTab.language}
            theme="obsidian-forge"
            options={{
              readOnly: false,
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderSideBySide: true,
              padding: { top: 8 },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
            }}
          />
        ) : (
          <Editor
            value={activeTab.content}
            language={activeTab.language}
            theme="obsidian-forge"
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: true, maxColumn: 80 },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              renderLineHighlight: "all",
              tabSize: 2,
              wordWrap: "off",
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
