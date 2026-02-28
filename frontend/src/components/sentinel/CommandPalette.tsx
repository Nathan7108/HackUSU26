import { useEffect, useState, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useAppStore } from "@/stores/app"
import { countries, getCountryByCode } from "@/data"
import { riskColor, riskMutedColor } from "@/lib/risk"
import {
  Search,
  X,
  Brain,
  Globe,
  AlertTriangle,
  TrendingUp,
  Shield,
  Send,
  Loader2,
} from "lucide-react"
import { useRouter } from "@tanstack/react-router"

interface Message {
  role: "user" | "assistant"
  content: string
}

const quickActions = [
  { label: "Show top risk countries", icon: AlertTriangle, action: "top-risk" },
  { label: "Analyze China exposure", icon: Globe, action: "analyze-CHN" },
  { label: "Taiwan supply chain risk", icon: TrendingUp, action: "analyze-TWN" },
  { label: "View all anomalies", icon: Shield, action: "anomalies" },
]

// Simulate AI responses based on queries
function generateResponse(query: string): string {
  const q = query.toLowerCase()

  if (q.includes("china") || q.includes("chn") || q.includes("rare earth")) {
    const c = getCountryByCode("CHN")!
    return `**China Risk Assessment** — Score: ${c.score}/100 (${c.riskLevel})\n\nKey findings:\n- ${c.causalChain[0]}\n- ${c.causalChain[1]}\n- ${c.causalChain[2]}\n\n**Cascade Exposure:** $${c.exposure?.totalExposure}M via Baotou processing facility.\n\n**Recommended Action:** ${c.recommendations?.[0]?.action} — ROI: ${c.recommendations?.[0]?.roi}x`
  }

  if (q.includes("taiwan") || q.includes("twn") || q.includes("semiconductor")) {
    const c = getCountryByCode("TWN")!
    return `**Taiwan Risk Assessment** — Score: ${c.score}/100 (${c.riskLevel})\n\n${c.brief}\n\n**Cascade Exposure:** $${c.exposure?.totalExposure}M — Hsinchu electronics packaging plant.\n\n**Immediate Action:** ${c.recommendations?.[0]?.action}`
  }

  if (q.includes("iran") || q.includes("irn")) {
    const c = getCountryByCode("IRN")!
    return `**Iran Risk Assessment** — Score: ${c.score}/100 (${c.riskLevel})\n\n${c.brief}\n\n**Cascade Exposure:** $${c.exposure?.totalExposure}M via Strait of Hormuz transit risk.`
  }

  if (q.includes("top") || q.includes("highest") || q.includes("worst")) {
    const top5 = [...countries].sort((a, b) => b.score - a.score).slice(0, 5)
    return `**Top 5 Risk Countries:**\n${top5.map((c, i) => `${i + 1}. ${c.flag} **${c.name}** — ${c.score}/100 (${c.riskLevel})`).join("\n")}\n\nTotal Cascade Exposure across top 5: $${top5.reduce((s, c) => s + (c.exposure?.totalExposure ?? 0), 0)}M`
  }

  if (q.includes("anomal")) {
    const anomalies = countries.filter((c) => c.isAnomaly)
    return `**Active Anomalies (${anomalies.length}):**\n${anomalies.map((c) => `- ${c.flag} **${c.name}** — Anomaly driver: \`${c.anomalyDriver}\` (detected ${c.anomalyTime})`).join("\n")}\n\nAll anomalies flagged by Isolation Forest with z-score > 2.0.`
  }

  if (q.includes("exposure") || q.includes("supply chain")) {
    const exposed = countries.filter((c) => c.exposure && c.exposure.totalExposure > 0)
    const total = exposed.reduce((s, c) => s + (c.exposure?.totalExposure ?? 0), 0)
    return `**Cascade Precision Exposure Summary:**\n\nTotal at-risk revenue: **$${total}M**\n\n${exposed.sort((a, b) => (b.exposure?.totalExposure ?? 0) - (a.exposure?.totalExposure ?? 0)).map((c) => `- ${c.flag} ${c.name}: $${c.exposure!.totalExposure}M`).join("\n")}`
  }

  return `Based on Sentinel AI analysis across 47 features and 6 data sources:\n\nThe global threat index is currently elevated at ${Math.round(countries.reduce((s, c) => s + c.score, 0) / countries.length)}/100. ${countries.filter((c) => c.isAnomaly).length} active anomalies detected.\n\nCascade Precision's highest exposure is in Taiwan ($680M) and China ($420M). Would you like me to drill into a specific country or risk area?`
}

export function CommandPalette() {
  const { isCommandOpen, setCommandOpen, selectCountry } = useAppStore()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcut
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

  // Auto-focus
  useEffect(() => {
    if (isCommandOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setMessages([])
      setQuery("")
    }
  }, [isCommandOpen])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSubmit(text?: string) {
    const input = text ?? query
    if (!input.trim()) return

    const userMsg: Message = { role: "user", content: input }
    setMessages((prev) => [...prev, userMsg])
    setQuery("")
    setIsTyping(true)

    // Simulate typing delay
    setTimeout(() => {
      const response = generateResponse(input)
      setMessages((prev) => [...prev, { role: "assistant", content: response }])
      setIsTyping(false)
    }, 600 + Math.random() * 400)
  }

  function handleQuickAction(action: string) {
    if (action === "top-risk") {
      handleSubmit("Show me the top risk countries")
    } else if (action.startsWith("analyze-")) {
      const code = action.replace("analyze-", "")
      handleSubmit(`Analyze ${getCountryByCode(code)?.name ?? code} risk and exposure`)
    } else if (action === "anomalies") {
      handleSubmit("Show all active anomalies")
    }
  }

  if (!isCommandOpen) return null

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        onClick={() => setCommandOpen(false)}
      >
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="flex w-[600px] max-h-[70vh] flex-col rounded-lg border shadow-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--sentinel-bg-surface)",
            borderColor: "var(--sentinel-border)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 border-b px-4 py-3"
            style={{ borderColor: "var(--sentinel-border-subtle)" }}
          >
            <Brain size={16} style={{ color: "var(--sentinel-accent)" }} />
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--sentinel-accent)" }}
            >
              Ask Sentinel AI
            </span>
            <div className="flex-1" />
            <kbd
              className="rounded px-1.5 py-0.5 font-data text-[9px]"
              style={{
                backgroundColor: "var(--sentinel-bg-overlay)",
                color: "var(--sentinel-text-tertiary)",
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div
              className="flex-1 overflow-y-auto px-4 py-3"
              style={{ maxHeight: "400px" }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor:
                        msg.role === "user"
                          ? "var(--sentinel-accent-muted)"
                          : "var(--sentinel-bg-elevated)",
                      color:
                        msg.role === "user"
                          ? "var(--sentinel-accent)"
                          : "var(--sentinel-text-primary)",
                    }}
                  >
                    {msg.content.split("\n").map((line, j) => (
                      <div key={j}>
                        {line.replace(/\*\*(.*?)\*\*/g, "«$1»").split("«").map((part, k) => {
                          if (part.includes("»")) {
                            const [bold, rest] = part.split("»")
                            return (
                              <span key={k}>
                                <strong>{bold}</strong>{rest}
                              </span>
                            )
                          }
                          return <span key={k}>{part}</span>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 mb-3">
                  <Loader2
                    size={12}
                    className="animate-spin"
                    style={{ color: "var(--sentinel-accent)" }}
                  />
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--sentinel-text-tertiary)" }}
                  >
                    Sentinel is analyzing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Quick actions (only show when no messages) */}
          {messages.length === 0 && (
            <div className="px-4 py-3">
              <span
                className="mb-2 block font-data text-[9px] font-bold tracking-wider"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                QUICK ACTIONS
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {quickActions.map((qa) => (
                  <button
                    key={qa.action}
                    onClick={() => handleQuickAction(qa.action)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors"
                    style={{
                      backgroundColor: "var(--sentinel-bg-elevated)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--sentinel-bg-overlay)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
                    }}
                  >
                    <qa.icon size={13} style={{ color: "var(--sentinel-accent)" }} />
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--sentinel-text-secondary)" }}
                    >
                      {qa.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div
            className="flex items-center gap-2 border-t px-4 py-3"
            style={{ borderColor: "var(--sentinel-border-subtle)" }}
          >
            <Search size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit()
              }}
              placeholder="Ask about risk, exposure, forecasts..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--sentinel-text-primary)" }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!query.trim()}
              className="flex h-6 w-6 items-center justify-center rounded transition-colors"
              style={{
                backgroundColor: query.trim() ? "var(--sentinel-accent)" : "var(--sentinel-bg-elevated)",
                color: query.trim() ? "white" : "var(--sentinel-text-tertiary)",
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
