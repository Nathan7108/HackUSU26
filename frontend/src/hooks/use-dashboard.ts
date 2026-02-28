import { useQuery } from "@tanstack/react-query"
import {
  fetchDashboardSummary,
  fetchDashboardAlerts,
  fetchKpiHistory,
  fetchAnalysis,
  type BackendDashboardSummary,
  type BackendAlert,
  type BackendAnalysis,
} from "@/lib/api"
import { toAlpha3, toAlpha2 } from "@/lib/country-codes"
import { getDashboardSummary } from "@/lib/dashboard"
import { getCountryByCode } from "@/data"
import type {
  DashboardSummary,
  Country,
  Alert,
  KPI,
  KpiDataPoint,
  RiskLevel,
  Trend,
} from "@/types"

// ── Transforms ──────────────────────────────────────────────────

function toRiskLevel(s: string): RiskLevel {
  const upper = s.toUpperCase()
  if (upper === "CRITICAL" || upper === "HIGH" || upper === "ELEVATED" || upper === "MODERATE" || upper === "LOW") {
    return upper as RiskLevel
  }
  return "MODERATE"
}

function toTrend(delta: number): Trend {
  if (delta > 1) return "ESCALATING"
  if (delta < -1) return "DE-ESCALATING"
  return "STABLE"
}

function mergeMockCountry(
  backend: { code: string; name: string; riskScore: number; riskLevel: string; isAnomaly: boolean; anomalyScore: number },
): Country {
  const code3 = toAlpha3(backend.code)
  const mock = getCountryByCode(code3)

  if (mock) {
    // Merge: real ML scores from backend + display details from mock
    return {
      ...mock,
      score: backend.riskScore,
      riskLevel: toRiskLevel(backend.riskLevel),
      isAnomaly: backend.isAnomaly,
    }
  }

  // Country not in mock data — create minimal entry from backend
  return {
    code: code3,
    name: backend.name,
    flag: "",
    score: backend.riskScore,
    riskLevel: toRiskLevel(backend.riskLevel),
    trend: "STABLE",
    trendDelta: 0,
    confidence: 0.8,
    isAnomaly: backend.isAnomaly,
    lat: 0,
    lng: 0,
    brief: `${backend.name} is assessed at ${backend.riskLevel} risk (${backend.riskScore}/100).`,
    causalChain: [],
    riskDrivers: [],
    forecast: [],
    headlines: [],
  }
}

function transformAlerts(backend: BackendAlert[]): Alert[] {
  return backend.map((a, i) => ({
    id: `live-${i}`,
    type: a.type as Alert["type"],
    severity: toRiskLevel(a.severity === "high" ? "HIGH" : a.severity === "medium" ? "ELEVATED" : a.severity.toUpperCase()),
    countryCode: toAlpha3(a.code),
    countryName: a.country,
    title: a.detail.split(" — ")[0] || a.detail,
    description: a.detail,
    timestamp: a.time,
  }))
}

function buildKpis(
  summary: BackendDashboardSummary,
  historyData: Array<{ date: string; globalThreatIndex: number; activeAnomalies: number; highPlusCountries: number; escalationAlerts24h: number }> | null,
): KPI[] {
  const gti = summary.globalThreatIndex
  const gtiTrend = toTrend(summary.globalThreatIndexDelta)

  const toChartData = (key: string): KpiDataPoint[] => {
    if (!historyData || historyData.length === 0) return []
    return historyData.map((h) => ({
      date: h.date,
      value: (h as Record<string, unknown>)[key] as number,
    }))
  }

  const toSparkline = (key: string): number[] => {
    if (!historyData || historyData.length === 0) return []
    return historyData.slice(-8).map((h) => (h as Record<string, unknown>)[key] as number)
  }

  return [
    {
      label: "Global Threat Index",
      value: gti,
      trend: gtiTrend,
      trendDelta: summary.globalThreatIndexDelta,
      sparkline: toSparkline("globalThreatIndex"),
      chartData: toChartData("globalThreatIndex"),
      chartColor: gti >= 70 ? "var(--risk-high)" : "var(--risk-elevated)",
    },
    {
      label: "Active Anomalies",
      value: summary.activeAnomalies,
      trend: "ESCALATING",
      trendDelta: 0,
      sparkline: toSparkline("activeAnomalies"),
      chartData: toChartData("activeAnomalies"),
      chartColor: "var(--risk-critical)",
    },
    {
      label: "CRITICAL + HIGH",
      value: summary.highPlusCountries,
      trend: toTrend(summary.highPlusCountriesDelta),
      trendDelta: summary.highPlusCountriesDelta,
      sparkline: toSparkline("highPlusCountries"),
      chartData: toChartData("highPlusCountries"),
      chartColor: "var(--risk-high)",
    },
    {
      label: "Escalation Alerts",
      value: summary.escalationAlerts24h,
      unit: "24h",
      trend: "STABLE",
      trendDelta: 0,
      sparkline: toSparkline("escalationAlerts24h"),
      chartData: toChartData("escalationAlerts24h"),
      chartColor: "var(--risk-elevated)",
    },
  ]
}

// ── Hooks ───────────────────────────────────────────────────────

const mockSummary = getDashboardSummary()

export function useDashboard() {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

  const alertsQuery = useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: async () => {
      const data = await fetchDashboardAlerts()
      return data.alerts
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  })

  const historyQuery = useQuery({
    queryKey: ["dashboard", "kpiHistory"],
    queryFn: async () => {
      const data = await fetchKpiHistory()
      return data.history
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

  // Build the DashboardSummary, merging backend data with mock fallback
  const isLive = summaryQuery.isSuccess && !!summaryQuery.data
  const backendSummary = summaryQuery.data

  let dashboard: DashboardSummary

  if (isLive && backendSummary) {
    const countries: Country[] = backendSummary.countries.map(mergeMockCountry)
    const alerts: Alert[] = alertsQuery.data && alertsQuery.data.length > 0
      ? transformAlerts(alertsQuery.data as unknown as BackendAlert[])
      : mockSummary.alerts
    const kpis = buildKpis(backendSummary, historyQuery.data ?? null)

    dashboard = {
      globalThreatIndex: backendSummary.globalThreatIndex,
      globalThreatTrend: toTrend(backendSummary.globalThreatIndexDelta),
      activeAnomalies: backendSummary.activeAnomalies,
      highPlusCountries: backendSummary.highPlusCountries,
      escalationAlerts24h: backendSummary.escalationAlerts24h,
      modelConfidence: backendSummary.modelHealth,
      countries,
      alerts,
      kpis,
    }
  } else {
    dashboard = mockSummary
  }

  return {
    dashboard,
    isLive,
    isLoading: summaryQuery.isLoading,
    error: summaryQuery.error,
  }
}

export function useAnalysis(countryCode3: string | null) {
  const code2 = countryCode3 ? toAlpha2(countryCode3) : ""
  const mock = countryCode3 ? getCountryByCode(countryCode3) : null

  return useQuery({
    queryKey: ["analysis", code2],
    queryFn: () => fetchAnalysis(mock?.name ?? countryCode3!, code2),
    enabled: !!countryCode3 && !!code2,
    staleTime: 1000 * 60 * 15,
    retry: 1,
    select: (data: BackendAnalysis): Partial<Country> => {
      // Transform backend analysis into fields that overlay on top of mock Country
      return {
        score: data.mlMetadata.riskScore,
        riskLevel: toRiskLevel(data.mlMetadata.riskLevel),
        confidence: data.mlMetadata.confidence,
        isAnomaly: data.mlMetadata.anomalyDetected,
        brief: data.summary,
        causalChain: data.causalChain.map((s) => s.event),
        riskDrivers: data.mlMetadata.topDrivers.slice(0, 5).map((d, i) => ({
          feature: d,
          importance: Math.max(0.05, 0.35 - i * 0.06),
        })),
      }
    },
  })
}
