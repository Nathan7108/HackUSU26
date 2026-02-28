import type { KPI, KpiDataPoint, DashboardSummary } from "@/types"
import { countries, getCountriesByRisk, getAnomalyCountries } from "@/data"
import { alerts } from "@/data"

function generateChartData(
  baseValues: number[],
  startDate: string = "2026-01-01",
): KpiDataPoint[] {
  const points: KpiDataPoint[] = []
  const start = new Date(startDate)

  for (let i = 0; i < baseValues.length; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i * 7) // weekly data
    points.push({
      date: date.toISOString().slice(0, 10),
      value: baseValues[i],
    })
  }
  return points
}

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
      chartData: generateChartData([54, 56, 58, 55, 60, 62, 64, 63, 66, 68, 67, 70, globalThreatIndex]),
      chartColor: globalThreatIndex >= 70 ? "var(--risk-high)" : "var(--risk-elevated)",
    },
    {
      label: "Active Anomalies",
      value: anomalies.length,
      trend: "ESCALATING",
      trendDelta: 1,
      sparkline: [1, 1, 2, 1, 2, 3, anomalies.length],
      chartData: generateChartData([0, 1, 1, 0, 1, 2, 1, 1, 2, 1, 2, 3, anomalies.length]),
      chartColor: "var(--risk-critical)",
    },
    {
      label: "CRITICAL + HIGH",
      value: highPlus,
      trend: "STABLE",
      trendDelta: 0,
      sparkline: [2, 3, 3, 2, 3, 3, highPlus],
      chartData: generateChartData([2, 2, 3, 3, 2, 2, 3, 3, 2, 3, 3, 3, highPlus]),
      chartColor: "var(--risk-high)",
    },
    {
      label: "Escalating Now",
      value: escalating,
      unit: "countries",
      trend: "ESCALATING",
      trendDelta: 2,
      sparkline: [2, 3, 3, 4, 3, 5, escalating],
      chartData: generateChartData([1, 2, 2, 3, 3, 2, 4, 3, 3, 4, 3, 5, escalating]),
      chartColor: "var(--risk-elevated)",
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
