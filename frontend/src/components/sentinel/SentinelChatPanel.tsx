import { useEffect, useState, useRef } from "react"
import { motion } from "motion/react"
import { Sparkles, X, ArrowUp, Loader2, RotateCcw, MessageSquare } from "lucide-react"
import { useAppStore } from "@/stores/app"
import { RenderMarkdown } from "@/components/sentinel/RenderMarkdown"
import { useDashboard } from "@/hooks/use-dashboard"
import { useChatStream } from "@/hooks/use-chat-stream"

const examplePrompts = [
  "Brief me on all active threats",
  "Tell me about Cascade Precision",
  "What's our exposure in Taiwan?",
  "Which anomalies need immediate attention?",
]

export function SentinelChatPanel() {
  const {
    isChatPanelOpen,
    setChatPanelOpen,
    chatMessages,
    clearChat,
    isStreaming,
    streamingText,
  } = useAppStore()
  const { dashboard } = useDashboard()
  const { submitMessage } = useChatStream()
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isChatPanelOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setChatPanelOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isChatPanelOpen, setChatPanelOpen])

  // Auto-focus on open
  useEffect(() => {
    if (isChatPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [isChatPanelOpen])

  // Scroll to bottom — instant during streaming, skip if user scrolled up
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [chatMessages, streamingText])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [query])

  const handleSubmit = (text?: string) => {
    const input = text ?? query
    if (!input.trim()) return
    setQuery("")
    submitMessage(input)
  }

  const hasMessages = chatMessages.length > 0 || !!streamingText

  const countryCount = dashboard?.countries?.length ?? 0
  const alertCount = dashboard?.alerts?.length ?? 0

  if (!isChatPanelOpen) return null

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 384, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0 flex flex-col h-full overflow-hidden border-l"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--sentinel-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--sentinel-accent-muted)" }}
          >
            <Sparkles size={14} style={{ color: "var(--sentinel-accent)" }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
              Sentinel AI
            </div>
            <div className="text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              Intelligence Analyst
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
            style={{ color: "var(--sentinel-text-tertiary)" }}
            title="New conversation"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setChatPanelOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
            style={{ color: "var(--sentinel-text-tertiary)" }}
            title="Close panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Context badge ── */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ borderBottom: "1px solid var(--sentinel-border-subtle)" }}
      >
        <div
          className="flex items-center gap-1.5 font-data text-[11px]"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--risk-low)" }}
          />
          {countryCount} countries monitored · {alertCount} alerts active
        </div>
      </div>

      {/* ── Messages area ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          /* ── Empty state ── */
          <div className="flex h-full flex-col justify-center">
            <div className="mb-6 text-center">
              <div
                className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--sentinel-accent-muted)" }}
              >
                <MessageSquare size={18} style={{ color: "var(--sentinel-accent)" }} />
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--sentinel-text-secondary)" }}>
                Ask about threats, risk scores, supply chain exposure, company intel, or country analysis.
              </p>
            </div>
            <div className="space-y-2">
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSubmit(prompt)}
                  className="w-full rounded-lg px-3 py-2 text-left text-[12px] transition-colors"
                  style={{
                    backgroundColor: "var(--sentinel-bg-elevated)",
                    color: "var(--sentinel-text-secondary)",
                    border: "1px solid var(--sentinel-border-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--sentinel-accent)"
                    e.currentTarget.style.color = "var(--sentinel-text-primary)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--sentinel-border-subtle)"
                    e.currentTarget.style.color = "var(--sentinel-text-secondary)"
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Conversation ── */
          <div>
            {chatMessages.map((msg, i) => (
              <div key={i} className="mb-4">
                {msg.role === "user" ? (
                  <div
                    className="text-sm font-medium"
                    style={{ color: "var(--sentinel-text-primary)" }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className="border-l-2 pl-3 text-[13px] leading-relaxed"
                    style={{
                      borderColor: "var(--sentinel-accent)",
                      color: "var(--sentinel-text-secondary)",
                    }}
                  >
                    <RenderMarkdown text={msg.content} />
                  </div>
                )}
              </div>
            ))}

            {streamingText && (
              <div className="mb-4">
                <div
                  className="border-l-2 pl-3 text-[13px] leading-relaxed"
                  style={{
                    borderColor: "var(--sentinel-accent)",
                    color: "var(--sentinel-text-secondary)",
                  }}
                >
                  <RenderMarkdown text={streamingText} />
                  <span
                    className="ml-0.5 inline-block h-3 w-[2px] animate-pulse rounded-full align-middle"
                    style={{ backgroundColor: "var(--sentinel-accent)" }}
                  />
                </div>
              </div>
            )}

            {isStreaming && !streamingText && (
              <div className="mb-4 flex items-center gap-2">
                <Loader2
                  size={12}
                  className="animate-spin"
                  style={{ color: "var(--sentinel-accent)" }}
                />
                <span className="text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
                  Analyzing...
                </span>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}
      >
        <div
          className="relative flex items-end rounded-lg px-3 py-2"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            border: "1px solid var(--sentinel-border-subtle)",
          }}
        >
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={hasMessages ? "Ask a follow-up..." : "Ask Sentinel AI..."}
            rows={1}
            className="flex-1 resize-none bg-transparent pr-8 text-[13px] leading-relaxed outline-none"
            style={{
              color: "var(--sentinel-text-primary)",
              caretColor: "var(--sentinel-accent)",
              minHeight: "24px",
            }}
            disabled={isStreaming}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!query.trim() || isStreaming}
            className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md transition-all"
            style={{
              backgroundColor: query.trim() && !isStreaming ? "var(--sentinel-accent)" : "transparent",
              color: query.trim() && !isStreaming ? "white" : "var(--sentinel-text-tertiary)",
              opacity: query.trim() ? 1 : 0.4,
            }}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-1.5 text-center">
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)", opacity: 0.4 }}
          >
            esc to close
          </span>
        </div>
      </div>
    </motion.div>
  )
}

