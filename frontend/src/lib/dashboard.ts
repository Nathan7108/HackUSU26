import type { KPI, DashboardSummary } from "@/types"
import { countries, getCountriesByRisk, getAnomalyCountries } from "@/data"
import { alerts } from "@/data"

export function getDashboardSummary(): DashboardSummary {
  const sorted = getCountriesByRisk()
  const anomalies = getAnomalyCountries()

  const globalThreatIndex = Math.round(
    sorted.reduce((sum, c) => sum + c.score, 0) / sorted.length,
  )

  const highPlus = countries.filter(
    (c) => c.riskLevel === "CRITICAL" || c.riskLevel === "HIGH",
  ).length

  const escalating = countries.filter(
    (c) => c.trend === "ESCALATING",
  ).length

  const avgConfidence = Math.round(
    countries.reduce((sum, c) => sum + c.confidence, 0) / countries.length * 100,
  )

  const kpis: KPI[] = [
    {
      label: "Global Threat Index",
      value: globalThreatIndex,
      trend: "ESCALATING",
      trendDelta: 2.4,
      sparkline: [62, 64, 63, 66, 68, 67, 70, globalThreatIndex],
    },
    {
      label: "Active Anomalies",
      value: anomalies.length,
      trend: "ESCALATING",
      trendDelta: 1,
      sparkline: [1, 1, 2, 1, 2, 3, anomalies.length],
    },
    {
      label: "CRITICAL + HIGH",
      value: highPlus,
      trend: "STABLE",
      trendDelta: 0,
      sparkline: [2, 3, 3, 2, 3, 3, highPlus],
    },
    {
      label: "Escalating Now",
      value: escalating,
      unit: "countries",
      trend: "ESCALATING",
      trendDelta: 2,
      sparkline: [2, 3, 3, 4, 3, 5, escalating],
    },
    {
      label: "Model Confidence",
      value: avgConfidence,
      unit: "%",
      trend: "STABLE",
      trendDelta: 0.2,
      sparkline: [84, 85, 85, 86, 85, 86, avgConfidence],
    },
  ]

  return {
    globalThreatIndex,
    globalThreatTrend: "ESCALATING",
    activeAnomalies: anomalies.length,
    highPlusCountries: highPlus,
    escalationAlerts24h: alerts.length,
    modelConfidence: avgConfidence,
    countries: sorted,
    alerts,
    kpis,
  }
}
