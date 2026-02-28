import { countries, facilities, tradeRoutes, getAnomalyCountries, getCountriesByRisk } from "@/data"
import type { DashboardSummary, Country } from "@/types"

// ── Context Serializer ─────────────────────────────────────────
// Packs ALL live dashboard data into a compact string for GPT's system prompt.

export function serializeContext(
  dashboard: DashboardSummary | null,
  selectedCountryCode: string | null,
): string {
  const sections: string[] = []
  const now = new Date().toISOString()

  // 1. KPIs
  if (dashboard) {
    sections.push(`## LIVE KPIs (as of ${now})
- Global Threat Index: ${dashboard.globalThreatIndex}/100 (${dashboard.globalThreatTrend})
- Active Anomalies: ${dashboard.activeAnomalies}
- CRITICAL + HIGH countries: ${dashboard.highPlusCountries}
- Escalation Alerts (24h): ${dashboard.escalationAlerts24h}
- Model Confidence: ${dashboard.modelConfidence}%`)
  }

  // 2. All countries with risk scores (use live dashboard data if available, else mock)
  const countryList = dashboard?.countries?.length ? dashboard.countries : getCountriesByRisk()
  sections.push(`## ALL MONITORED COUNTRIES (${countryList.length})
${countryList
  .sort((a, b) => b.score - a.score)
  .map((c) => {
    let line = `- ${c.flag} ${c.name} (${c.code}): ${c.score}/100 ${c.riskLevel} | trend: ${c.trend} (${c.trendDelta > 0 ? "+" : ""}${c.trendDelta})`
    if (c.isAnomaly) line += ` | ANOMALY: ${c.anomalyDriver ?? "detected"}`
    if (c.exposure) line += ` | Cascade exposure: $${c.exposure.totalExposure}M`
    return line
  })
  .join("\n")}`)

  // 3. Active alerts
  const liveAlerts = dashboard?.alerts ?? []
  sections.push(`## ACTIVE ALERTS (${liveAlerts.length})
${liveAlerts
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .map((a) => `- [${a.severity}] ${a.title} — ${a.description} (${a.timestamp})`)
  .join("\n")}`)

  // 4. Anomalies detail
  const anomalies = getAnomalyCountries()
  if (anomalies.length > 0) {
    sections.push(`## ANOMALY DETAILS (Isolation Forest)
${anomalies.map((c) => `- ${c.name}: driver="${c.anomalyDriver}" detected=${c.anomalyTime}`).join("\n")}`)
  }

  // 5. Cascade Precision facilities
  sections.push(`## CASCADE PRECISION FACILITIES (${facilities.length})
${facilities.map((f) => `- ${f.name} (${f.id}) — ${f.location} | ${f.function} | $${f.annualValue}M/yr`).join("\n")}`)

  // 6. Trade routes
  sections.push(`## SUPPLY CHAIN ROUTES (${tradeRoutes.length})
${tradeRoutes.map((r) => `- ${r.id}: ${r.from.name} (${r.from.location}) → ${r.to.name} (${r.to.location}) via ${r.chokepoint} | ${r.riskLevel} | $${r.annualCargo}M cargo`).join("\n")}`)

  // 7. Currently selected country (what user is looking at)
  if (selectedCountryCode) {
    const sel = countryList.find((c) => c.code === selectedCountryCode)
    if (sel) {
      sections.push(`## CURRENTLY SELECTED COUNTRY: ${sel.name} (${sel.code})
- Risk Score: ${sel.score}/100 (${sel.riskLevel})
- Trend: ${sel.trend} (${sel.trendDelta > 0 ? "+" : ""}${sel.trendDelta})
- Anomaly: ${sel.isAnomaly ? `YES — ${sel.anomalyDriver}` : "No"}
- Brief: ${sel.brief}
- Causal Chain: ${sel.causalChain.join(" → ")}
- Recommendations: ${sel.recommendations?.map((r) => `${r.priority}: ${r.action} (ROI ${r.roi}x)`).join("; ") ?? "None"}
- Exposure: ${sel.exposure ? `$${sel.exposure.totalExposure}M — ${sel.exposure.description}` : "No direct Cascade exposure"}
- Headlines: ${sel.headlines.map((h) => `[${h.sentiment}] ${h.text} (${h.source})`).join("; ")}`)
    }
  }

  // 8. ML model info
  sections.push(`## PLATFORM SPECS
- 4 ML models: XGBoost Risk Scorer (47 features), LSTM Forecaster (30/60/90 day), Isolation Forest Anomaly Detector, FinBERT Sentiment
- 107 data sources across 12 intelligence domains
- 6 active pipeline sources: GDELT, ACLED, UCDP, World Bank, NewsAPI, FinBERT
- 6 live API feeds: USGS Earthquakes, GDACS Disasters, Frankfurter FX, ReliefWeb, OONI, NASA EONET
- Customer: Cascade Precision Industries — $3.8B aerospace manufacturer, Portland OR HQ`)

  return sections.join("\n\n")
}

// ── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Sentinel AI, an elite geopolitical intelligence analyst built into a real-time crisis prediction platform. You have access to LIVE data from 107 sources across 12 intelligence domains, processed by 4 ML models (XGBoost, LSTM, Isolation Forest, FinBERT).

Your customer is Cascade Precision Industries, a $3.8B aerospace manufacturer. Your job is to provide sharp, actionable intelligence about geopolitical risks and their supply chain impact.

RULES:
- Be concise and direct. Use the Bloomberg/Palantir analyst tone.
- Always cite specific numbers from the live data below — risk scores, dollar exposures, anomaly drivers.
- When discussing a country, reference its exact current score, trend, and any anomalies.
- When discussing supply chain risk, reference specific facilities, trade routes, and chokepoints.
- Format with **bold** for key metrics and use bullet points for clarity.
- If the user asks about something not in the data, say so honestly.
- Never make up data. Only reference what's in the live context below.
- Keep responses under 200 words unless the user asks for a deep dive.

LIVE DASHBOARD DATA:
`

// ── OpenAI Streaming Client ────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function streamChat(
  messages: ChatMessage[],
  context: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    onError(new Error("VITE_OPENAI_API_KEY not set"))
    return
  }

  const systemMessage: ChatMessage = {
    role: "system",
    content: SYSTEM_PROMPT + context,
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [systemMessage, ...messages],
        stream: true,
        max_tokens: 800,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      onError(new Error(`OpenAI API error ${res.status}: ${err}`))
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onError(new Error("No response body"))
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith("data: ")) continue
        const data = trimmed.slice(6)
        if (data === "[DONE]") {
          onDone()
          return
        }
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) onChunk(delta)
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone()
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}
