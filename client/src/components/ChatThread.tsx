/*
 * Obsidian Forge — Chat Thread
 * Clean message bubbles, tool call inline cards, streaming-ready layout.
 */
import { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Terminal, Loader2, Paperclip } from "lucide-react";
import { Streamdown } from "streamdown";
import { useIDEStore, type ChatMessage } from "@/lib/store";
import { cn } from "@/lib/utils";

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";
  const isSystem = msg.role === "system";

  if (isTool) {
    return (
      <div className="flex items-start gap-2 px-4 py-1.5">
        <div className="w-5 h-5 rounded bg-forge-surface-overlay flex items-center justify-center shrink-0 mt-0.5">
          <Terminal className="w-3 h-3 text-forge-amber-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-mono-code text-muted-foreground/60 bg-forge-gutter/50 rounded px-2 py-1">
            {msg.toolCall && (
              <span className="text-forge-amber-dim">{msg.toolCall.tool}</span>
            )}
            {" → "}
            <span className="text-muted-foreground/80">{msg.content}</span>
          </div>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="px-4 py-1">
        <p className="text-[10px] text-muted-foreground/40 text-center font-mono-code">{msg.content}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-2 px-4 py-2", isUser && "flex-row-reverse")}>
      <div className={cn(
        "w-6 h-6 rounded flex items-center justify-center shrink-0",
        isUser ? "bg-forge-amber/20" : "bg-forge-surface-overlay"
      )}>
        {isUser ? (
          <User className="w-3.5 h-3.5 text-forge-amber" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-forge-teal" />
        )}
      </div>
      <div className={cn(
        "flex-1 min-w-0 max-w-[85%]",
        isUser && "text-right"
      )}>
        <div className={cn(
          "inline-block text-[12.5px] leading-relaxed rounded-lg px-3 py-2",
          isUser
            ? "bg-forge-amber/10 text-foreground"
            : "bg-forge-surface-raised text-foreground/90"
        )}>
          {msg.role === "assistant" ? (
            <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_code]:text-forge-amber [&_code]:bg-forge-gutter/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-forge-gutter [&_pre]:rounded">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          ) : (
            <p>{msg.content}</p>
          )}
        </div>
        <p className="text-[9px] text-muted-foreground/30 mt-1 font-mono-code">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function ChatThread() {
  const { currentRun, addMessage, startRun, agentStatus } = useIDEStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = currentRun?.messages || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    if (!currentRun) {
      startRun(text.slice(0, 60));
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    });

    setInput("");

    // Simulate agent response
    setTimeout(() => {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'll analyze the request and create a plan. Let me start by examining the relevant files...",
        timestamp: Date.now(),
      });
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[12px] font-semibold text-foreground">Chat</span>
        {currentRun && (
          <span className="text-[10px] text-muted-foreground/50 font-mono-code">
            {messages.length} messages
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full p-6">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-forge-surface-raised flex items-center justify-center">
                <Bot className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-[12px] text-muted-foreground">Start a conversation</p>
              <p className="text-[10px] text-muted-foreground/40 max-w-[200px]">
                Ask Hermes to refactor code, fix bugs, add features, or explain your codebase.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        {agentStatus === "thinking" && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="w-6 h-6 rounded bg-forge-surface-overlay flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-forge-amber animate-spin" />
            </div>
            <span className="text-[11px] text-muted-foreground/50">Hermes is thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex items-end gap-2 bg-forge-surface-raised rounded-lg px-3 py-2">
          <button className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 mb-0.5">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Hermes..."
            rows={1}
            className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/30 resize-none outline-none min-h-[20px] max-h-[120px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "p-1.5 rounded transition-colors shrink-0 mb-0.5",
              input.trim()
                ? "bg-forge-amber text-forge-gutter hover:bg-forge-amber/90"
                : "text-muted-foreground/20"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/25 mt-1 px-1">
          Enter to send · Shift+Enter for new line · Ctrl+Shift+D toggle diff
        </p>
      </div>
    </div>
  );
}
