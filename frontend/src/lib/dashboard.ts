import type { DashboardSummary, Trend } from "@/types"
import { countries, alerts, getCountriesByRisk, getAnomalyCountries } from "@/data"

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

  // Derive global trend from individual country trends
  const escalating = countries.filter((c) => c.trend === "ESCALATING").length
  const deescalating = countries.filter((c) => c.trend === "DE-ESCALATING").length
  const globalThreatTrend: Trend =
    escalating > deescalating + 2 ? "ESCALATING" :
    deescalating > escalating + 2 ? "DE-ESCALATING" : "STABLE"

  // Derive escalation alerts from mock alerts data
  const escalationAlerts24h = alerts.length

  return {
    globalThreatIndex,
    globalThreatTrend,
    activeAnomalies: anomalies.length,
    highPlusCountries: highPlus,
    escalationAlerts24h,
    modelConfidence: avgConfidence,
    countries: sorted,
    alerts,
    kpis: [
      { label: "Global Threat Index", value: globalThreatIndex, trend: globalThreatTrend, trendDelta: Math.round(countries.reduce((s, c) => s + c.trendDelta, 0) / countries.length * 10) / 10, chartData: [], chartColor: globalThreatIndex >= 70 ? "var(--risk-high)" : "var(--risk-elevated)" },
      { label: "Active Anomalies", value: anomalies.length, trend: anomalies.length > 2 ? "ESCALATING" : "STABLE", trendDelta: anomalies.length, chartData: [], chartColor: "var(--risk-critical)" },
      { label: "CRITICAL + HIGH", value: highPlus, trend: highPlus >= 4 ? "ESCALATING" : "STABLE", trendDelta: highPlus, chartData: [], chartColor: "var(--risk-high)" },
      { label: "Escalation Alerts", value: escalationAlerts24h, unit: "24h", trend: escalationAlerts24h > 4 ? "ESCALATING" : "STABLE", trendDelta: escalationAlerts24h, chartData: [], chartColor: "var(--risk-elevated)" },
    ],
  }
}
