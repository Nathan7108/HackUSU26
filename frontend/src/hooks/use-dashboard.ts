import { useQuery } from "@tanstack/react-query"
import {
  fetchDashboardSummary,
  fetchDashboardAlerts,
  fetchKpiHistory,
  fetchAnalysis,
  fetchForecast,
  fetchExposure,
  fetchRecommendations,
  fetchHeadlines,
  type BackendDashboardSummary,
  type BackendAlert,
  type BackendAnalysis,
} from "@/lib/api"
import { toAlpha3, toAlpha2, flagFromAlpha2 } from "@/lib/country-codes"
import { COUNTRY_COORDS } from "@/data/countryCoords"
import type {
  DashboardSummary,
  Country,
  Alert,
  KPI,
  KpiDataPoint,
  ForecastPoint,
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

function backendToCountry(
  backend: { code: string; name: string; riskScore: number; riskLevel: string; isAnomaly: boolean; anomalyScore: number; scoreDelta: number },
): Country {
  const code2 = backend.code
  const code3 = toAlpha3(code2)
  const delta = backend.scoreDelta ?? 0
  const trend = toTrend(delta)
  const coords = COUNTRY_COORDS[code2] ?? [0, 0]

  return {
    code: code3,
    name: backend.name,
    flag: flagFromAlpha2(code2),
    score: backend.riskScore,
    riskLevel: toRiskLevel(backend.riskLevel),
    trend,
    trendDelta: delta,
    confidence: 0.85,
    isAnomaly: backend.isAnomaly,
    lat: coords[0],
    lng: coords[1],
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

interface KpiHistoryMap {
  globalThreatIndex?: KpiDataPoint[]
  activeAnomalies?: KpiDataPoint[]
  highPlusCountries?: KpiDataPoint[]
  escalationAlerts24h?: KpiDataPoint[]
}

/** Derive trend + delta from current live value vs previous history point */
function trendFromHistory(currentValue: number, points: KpiDataPoint[] | undefined): { trend: Trend; delta: number } {
  if (!points || points.length < 1) return { trend: "STABLE", delta: 0 }
  // Compare current live value against the second-to-last point (the previous snapshot)
  const prevIdx = Math.max(0, points.length - 2)
  const prev = points[prevIdx].value
  const delta = Math.round((currentValue - prev) * 10) / 10
  return { trend: toTrend(delta), delta }
}

function buildKpis(
  summary: BackendDashboardSummary,
  history: KpiHistoryMap | null,
): KPI[] {
  const gtiHist = history?.globalThreatIndex ?? []
  const anomHist = history?.activeAnomalies ?? []
  const highHist = history?.highPlusCountries ?? []
  const escHist = history?.escalationAlerts24h ?? []

  const gti = summary.globalThreatIndex

  const gtiTrend = trendFromHistory(gti, gtiHist)
  const anomTrend = trendFromHistory(summary.activeAnomalies, anomHist)
  const highTrend = trendFromHistory(summary.highPlusCountries, highHist)
  const escTrend = trendFromHistory(summary.escalationAlerts24h, escHist)

  return [
    {
      label: "Global Threat Index",
      value: gti,
      trend: gtiTrend.trend,
      trendDelta: gtiTrend.delta,
      chartData: gtiHist,
      chartColor: gti >= 70 ? "var(--risk-high)" : "var(--risk-elevated)",
    },
    {
      label: "Active Anomalies",
      value: summary.activeAnomalies,
      trend: anomTrend.trend,
      trendDelta: anomTrend.delta,
      chartData: anomHist,
      chartColor: "var(--risk-critical)",
    },
    {
      label: "CRITICAL + HIGH",
      value: summary.highPlusCountries,
      trend: highTrend.trend,
      trendDelta: highTrend.delta,
      chartData: highHist,
      chartColor: "var(--risk-high)",
    },
    {
      label: "Escalation Alerts",
      value: summary.escalationAlerts24h,
      unit: "24h",
      trend: escTrend.trend,
      trendDelta: escTrend.delta,
      chartData: escHist,
      chartColor: "var(--risk-elevated)",
    },
  ]
}

// ── Hooks ───────────────────────────────────────────────────────

export function useDashboard() {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
  })

  const alertsQuery = useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: async () => {
      const data = await fetchDashboardAlerts()
      return data.alerts
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
  })

  const historyQuery = useQuery({
    queryKey: ["dashboard", "kpiHistory"],
    queryFn: async (): Promise<KpiHistoryMap> => {
      const data = await fetchKpiHistory()
      const toPoints = (m: { values: Array<{ date: string; value: number }> } | undefined): KpiDataPoint[] =>
        m?.values?.map((v) => ({ date: v.date, value: v.value })) ?? []
      return {
        globalThreatIndex: toPoints(data.globalThreatIndex),
        activeAnomalies: toPoints(data.activeAnomalies),
        highPlusCountries: toPoints(data.highPlusCountries),
        escalationAlerts24h: toPoints(data.escalationAlerts24h),
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
  })

  const backendSummary = summaryQuery.data
  const isLive = summaryQuery.isSuccess && !!backendSummary

  let dashboard: DashboardSummary | null = null

  if (isLive && backendSummary) {
    const countries: Country[] = backendSummary.countries.map(backendToCountry)
    let alerts: Alert[] = []
    try {
      if (alertsQuery.data) {
        alerts = transformAlerts(alertsQuery.data as unknown as BackendAlert[])
      }
    } catch {
      console.warn("[Sentinel] Failed to transform alerts:", alertsQuery.data)
    }
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
  }

  return {
    dashboard,
    isLive,
    isLoading: summaryQuery.isLoading,
    error: summaryQuery.error,
  }
}

export function useExposure() {
  return useQuery({
    queryKey: ["exposure"],
    queryFn: fetchExposure,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
}

export function useRecommendations() {
  return useQuery({
    queryKey: ["recommendations"],
    queryFn: fetchRecommendations,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
}

export function useHeadlines() {
  return useQuery({
    queryKey: ["headlines"],
    queryFn: fetchHeadlines,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    retry: 1,
  })
}

export function useAnalysis(countryCode3: string | null) {
  const code2 = countryCode3 ? toAlpha2(countryCode3) : ""
  const name = countryCode3 ?? ""

  return useQuery({
    queryKey: ["analysis", code2],
    queryFn: () => fetchAnalysis(name, code2),
    enabled: !!countryCode3 && !!code2,
    staleTime: 1000 * 60 * 15,
    retry: 1,
    select: (data: BackendAnalysis): Partial<Country> => {
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
        headlines: data.keyFactors.map((factor) => ({
          text: factor,
          sentiment: "negative" as const,
          source: "Sentinel AI",
        })),
      }
    },
  })
}

export function useForecast(countryCode3: string | null) {
  const code2 = countryCode3 ? toAlpha2(countryCode3) : ""
  const name = countryCode3 ?? ""

  return useQuery({
    queryKey: ["forecast", code2],
    queryFn: () => fetchForecast(name, code2),
    enabled: !!countryCode3 && !!code2,
    staleTime: 1000 * 60 * 15,
    retry: 1,
    select: (data): { forecast: ForecastPoint[]; trend: Trend } => {
      const current = data.forecast_30d
      return {
        forecast: [
          { day: 0, score: current },
          { day: 15, score: Math.round((current + data.forecast_30d) / 2) },
          { day: 30, score: data.forecast_30d },
          { day: 45, score: Math.round((data.forecast_30d + data.forecast_60d) / 2) },
          { day: 60, score: data.forecast_60d },
          { day: 75, score: Math.round((data.forecast_60d + data.forecast_90d) / 2) },
          { day: 90, score: data.forecast_90d },
        ],
        trend: toTrend(data.forecast_90d - current),
      }
    },
  })
}
