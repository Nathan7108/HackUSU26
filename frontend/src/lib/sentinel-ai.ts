import { facilities, tradeRoutes, companyProfile } from "@/data"
import type { DashboardSummary } from "@/types"
import type { BackendRecommendation } from "@/lib/api"

// ── Context Serializer ─────────────────────────────────────────
// Packs ALL live dashboard data into a compact string for GPT's system prompt.

export function serializeContext(
  dashboard: DashboardSummary | null,
  selectedCountryCode: string | null,
  recommendations?: BackendRecommendation[],
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

  // 2. All countries with risk scores (live API data only)
  const countryList = dashboard?.countries ?? []
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

  // 4. Anomalies detail (from live dashboard data)
  const anomalies = countryList.filter((c) => c.isAnomaly)
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
- Causal Chain: ${sel.causalChain.map((s) => s.event).join(" → ")}
- Recommendations: ${sel.recommendations?.map((r) => `${r.priority}: ${r.action} (ROI ${r.roi}x)`).join("; ") ?? "None"}
- Exposure: ${sel.exposure ? `$${sel.exposure.totalExposure}M — ${sel.exposure.description}` : "No direct Cascade exposure"}
- Headlines: ${sel.headlines.map((h) => `[${h.sentiment}] ${h.text} (${h.source})`).join("; ")}`)
    }
  }

  // 8. Active recommendations (GPT-4o generated mitigation actions)
  if (recommendations && recommendations.length > 0) {
    sections.push(`## ACTIVE RECOMMENDATIONS (${recommendations.length} actions)
${recommendations.map((r) => `- [${r.priority}] ${r.countryName} (${r.countryCode}): ${r.action}
  Cost: $${r.cost}M | Protected: $${r.riskReduction}M | ROI: ${r.roi}x | Lead: ${r.leadTime}
  Trigger: ${r.trigger}
  Evidence: ${r.evidence.slice(0, 200)}...`).join("\n")}`)
  }

  // 9. Company profile
  sections.push(`## CASCADE PRECISION — COMPANY PROFILE
- Name: ${companyProfile.name} (${companyProfile.ticker})
- CEO: ${companyProfile.ceo} | Founded: ${companyProfile.founded}
- HQ: ${companyProfile.hq}
- Revenue: ${companyProfile.revenue} | Employees: ${companyProfile.employees}
- Sector: ${companyProfile.sector}
- Customers: ${companyProfile.customers.join(", ")}
- Description: ${companyProfile.description}
- Supply Chain Exposure: ${companyProfile.supplyChainExposure.total} (${companyProfile.supplyChainExposure.percentOfRevenue}% of revenue) through ${companyProfile.supplyChainExposure.chokepoints} chokepoints
- ${companyProfile.supplyChainExposure.summary}

### Historical Losses ($70M total)
${companyProfile.historicalLosses.map((l) => `- ${l.event} (${l.year}): ${l.amount} — ${l.description}`).join("\n")}

### Key Risk Hotspots
${companyProfile.keyRisks.map((r) => `- ${r.hotspot}: ${r.exposure} — ${r.basis}`).join("\n")}

### Sentinel Recommendations
${companyProfile.recommendations.map((cat) => `**${cat.category}:**\n${cat.actions.map((a) => `  - ${a}`).join("\n")}`).join("\n")}`)

  // 9. ML model info
  sections.push(`## PLATFORM SPECS
- 4 ML models: XGBoost Risk Scorer (47 features), LSTM Forecaster (30/60/90 day), Isolation Forest Anomaly Detector, FinBERT Sentiment
- 107 data sources across 12 intelligence domains
- 6 active pipeline sources: GDELT, ACLED, UCDP, World Bank, NewsAPI, FinBERT
- 6 live API feeds: USGS Earthquakes, GDACS Disasters, Frankfurter FX, ReliefWeb, OONI, NASA EONET
- Customer: Cascade Precision Industries — $3.8B aerospace manufacturer, Portland OR HQ`)

  return sections.join("\n\n")
}

// ── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Sentinel AI, an elite geopolitical intelligence analyst embedded in a real-time crisis prediction platform.

CRITICAL RULES — YOU MUST FOLLOW THESE:
1. **ONLY use numbers from the LIVE DASHBOARD DATA below.** Every risk score, anomaly count, GTI value, dollar exposure, and country risk level you cite MUST come verbatim from the data provided. If a number is not in the data, DO NOT invent one.
2. **Never fabricate events, scores, or statistics.** If you don't have data on something, say "not currently tracked" or "outside our monitoring scope."
3. **Never round, estimate, or inflate numbers.** If Iran's risk score is 60, say 60 — not 94, not "approximately 90."
4. **Distinguish between ML-detected data and general knowledge.** You may reference real-world events you know about (e.g. Houthi attacks, China rare earth controls) but ALWAYS pair them with the exact Sentinel risk scores and exposure figures from the data. Never assign scores that aren't in the data.
5. **Active anomalies, alerts, and country counts must match the data exactly.** Do not exaggerate the number of alerts or anomalies.

YOUR CLIENT: Cascade Precision Industries (CSPI) — $3.8B Tier 2 aerospace manufacturer, Portland OR. You know their facilities, supply chains, exposures, and historical losses from the data below.

RESPONSE STYLE:
- **Tone**: Senior intelligence analyst briefing a C-suite executive. Confident, precise, no filler.
- **Structure**: Use **bold** for key metrics, dollar amounts, and risk levels. Use bullet points for lists.
- **Data grounding**: Always cite the exact score from the data: "Yemen is at **78/100 HIGH**" not "Yemen is at critical risk."
- **Actionable**: End with a concrete next step — what should CSPI do RIGHT NOW? Reference specific recommendations from the data (cost-to-act vs cost-of-inaction).
- **Context**: Connect risks to specific CSPI facilities, routes, and dollar exposures.
- **Length**: 150-300 words. Go deeper only when asked.

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
        max_tokens: 1000,
        temperature: 0.3,
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
