import type { DashboardSummary } from "@/types"
import { countries, getCountriesByRisk, getAnomalyCountries } from "@/data"

export function getDashboardSummary(): DashboardSummary {
  const sorted = getCountriesByRisk()
  const anomalies = getAnomalyCountries()

  const globalThreatIndex = Math.round(
    sorted.reduce((sum, c) => sum + c.score, 0) / sorted.length,
  )

  const highPlus = countries.filter(
    (c) => c.riskLevel === "CRITICAL" || c.riskLevel === "HIGH",
  ).length

  const avgConfidence = Math.round(
    countries.reduce((sum, c) => sum + c.confidence, 0) / countries.length * 100,
  )

  return {
    globalThreatIndex,
    globalThreatTrend: "STABLE",
    activeAnomalies: anomalies.length,
    highPlusCountries: highPlus,
    escalationAlerts24h: 0,
    modelConfidence: avgConfidence,
    countries: sorted,
    alerts: [],
    kpis: [
      { label: "Global Threat Index", value: globalThreatIndex, trend: "STABLE", trendDelta: 0, chartData: [], chartColor: "var(--risk-elevated)" },
      { label: "Active Anomalies", value: anomalies.length, trend: "STABLE", trendDelta: 0, chartData: [], chartColor: "var(--risk-critical)" },
      { label: "CRITICAL + HIGH", value: highPlus, trend: "STABLE", trendDelta: 0, chartData: [], chartColor: "var(--risk-high)" },
      { label: "Escalation Alerts", value: 0, unit: "24h", trend: "STABLE", trendDelta: 0, chartData: [], chartColor: "var(--risk-elevated)" },
    ],
  }
}
