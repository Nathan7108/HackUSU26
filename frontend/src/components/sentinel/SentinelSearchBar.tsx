import { useEffect, useState, useRef, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Sparkles, ArrowUp, Loader2, RotateCcw } from "lucide-react"
import { useAppStore } from "@/stores/app"
import { useDashboard } from "@/hooks/use-dashboard"
import { serializeContext, streamChat, type ChatMessage } from "@/lib/sentinel-ai"

const examplePrompts = [
  "Brief me on all active threats",
  "What's driving Taiwan's risk score?",
  "Cascade supply chain exposure breakdown",
  "Which anomalies need immediate attention?",
]

export function SentinelSearchBar() {
  const {
    isCommandOpen,
    setCommandOpen,
    selectedCountryCode,
    chatMessages,
    setChatMessages,
    clearChat,
  } = useAppStore()
  const { dashboard } = useDashboard()
  const [query, setQuery] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Rotate placeholder
  useEffect(() => {
    if (!isCommandOpen || chatMessages.length > 0) return
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % examplePrompts.length), 4000)
    return () => clearInterval(t)
  }, [isCommandOpen, chatMessages.length])

  // Keyboard shortcut + escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen(!isCommandOpen)
      }
      if (e.key === "Escape" && isCommandOpen) {
        setCommandOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isCommandOpen, setCommandOpen])

  // Click outside to close
  useEffect(() => {
    if (!isCommandOpen) return
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setCommandOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [isCommandOpen, setCommandOpen])

  // Auto-focus textarea when opened
  useEffect(() => {
    if (isCommandOpen) {
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      setQuery("")
    }
  }, [isCommandOpen])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, streamingText])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [query])

  const handleSubmit = useCallback(
    (text?: string) => {
      const input = text ?? query
      if (!input.trim() || isStreaming) return

      setChatMessages((prev) => [...prev, { role: "user", content: input }])
      setQuery("")
      setIsStreaming(true)
      setStreamingText("")

      const history: ChatMessage[] = [
        ...chatMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: input },
      ]

      const context = serializeContext(dashboard, selectedCountryCode)
      let accumulated = ""

      streamChat(
        history,
        context,
        (chunk) => {
          accumulated += chunk
          setStreamingText(accumulated)
        },
        () => {
          setChatMessages((prev) => [...prev, { role: "assistant", content: accumulated }])
          setStreamingText("")
          setIsStreaming(false)
        },
        (err) => {
          console.error("Sentinel AI error:", err)
          setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }])
          setStreamingText("")
          setIsStreaming(false)
        },
      )
    },
    [query, chatMessages, isStreaming, dashboard, selectedCountryCode, setChatMessages],
  )

  const hasMessages = chatMessages.length > 0 || !!streamingText

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      {/* ── Search bar trigger ── */}
      <button
        onClick={() => setCommandOpen(!isCommandOpen)}
        className="group flex h-8 w-full items-center gap-2.5 px-4 transition-all"
        style={{
          backgroundColor: isCommandOpen
            ? "var(--sentinel-bg-overlay)"
            : "var(--sentinel-bg-elevated)",
          border: `1px solid ${isCommandOpen ? "var(--sentinel-accent)" : "var(--sentinel-border)"}`,
          borderRadius: isCommandOpen ? "12px 12px 0 0" : "9999px",
        }}
      >
        <Sparkles
          size={13}
          className="transition-colors"
          style={{
            color: isCommandOpen
              ? "var(--sentinel-accent)"
              : "var(--sentinel-text-tertiary)",
          }}
        />
        <span
          className="flex-1 text-left text-[12px] transition-colors"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          Ask Sentinel AI...
        </span>
        <kbd
          className="rounded px-1.5 py-0.5 font-data text-[10px] transition-colors"
          style={{
            backgroundColor: isCommandOpen
              ? "var(--sentinel-accent-muted)"
              : "var(--sentinel-bg-overlay)",
            color: isCommandOpen
              ? "var(--sentinel-accent)"
              : "var(--sentinel-text-tertiary)",
          }}
        >
          Ctrl K
        </kbd>
      </button>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {isCommandOpen && (
          <motion.div
            key="sentinel-dropdown"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 z-50 flex flex-col overflow-hidden"
            style={{
              top: "100%",
              maxHeight: "min(480px, calc(100vh - 80px))",
              borderRadius: "0 0 12px 12px",
              backgroundColor: "var(--sentinel-bg-surface)",
              borderLeft: "1px solid var(--sentinel-accent)",
              borderRight: "1px solid var(--sentinel-accent)",
              borderBottom: "1px solid var(--sentinel-accent)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            }}
          >
            {/* ── Empty state ── */}
            {!hasMessages && (
              <div className="px-4 py-4">
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--sentinel-text-secondary)" }}>
                  Ask anything about threats, risk scores, supply chain exposure, or country analysis.
                </p>
              </div>
            )}

            {/* ── Messages ── */}
            {hasMessages && (
              <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 340 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} className="mb-3">
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
                  <div className="mb-3">
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
                  <div className="mb-3 flex items-center gap-2">
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

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* ── Input area ── */}
            <div
              className="relative shrink-0 px-4 py-3"
              style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}
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
                placeholder={hasMessages ? "Ask a follow-up..." : examplePrompts[placeholderIdx]}
                rows={1}
                className="w-full resize-none bg-transparent pr-8 text-[13px] leading-relaxed outline-none"
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
                className="absolute bottom-3 right-4 flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                style={{
                  backgroundColor: query.trim() && !isStreaming ? "var(--sentinel-accent)" : "transparent",
                  color: query.trim() && !isStreaming ? "white" : "var(--sentinel-text-tertiary)",
                  opacity: query.trim() ? 1 : 0.4,
                }}
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Footer (when messages exist) ── */}
            {hasMessages && (
              <div
                className="flex shrink-0 items-center justify-between px-4 py-1.5"
                style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}
              >
                <button
                  onClick={() => {
                    clearChat()
                    setStreamingText("")
                  }}
                  className="flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-80"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  <RotateCcw size={10} />
                  New conversation
                </button>
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--sentinel-text-tertiary)", opacity: 0.4 }}
                >
                  esc to close
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Markdown ────────────────────────────────────────────────────

function RenderMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, j) => (
        <div key={j} className={line === "" ? "h-2" : ""}>
          {line
            .replace(/\*\*(.*?)\*\*/g, "«$1»")
            .split("«")
            .map((part, k) => {
              if (part.includes("»")) {
                const [bold, rest] = part.split("»")
                return (
                  <span key={k}>
                    <strong style={{ color: "var(--sentinel-text-primary)" }}>{bold}</strong>
                    {rest}
                  </span>
                )
              }
              return <span key={k}>{part}</span>
            })}
        </div>
      ))}
    </>
  )
}
