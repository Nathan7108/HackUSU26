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
  type BackendForecast,
} from "@/lib/api"
import { applyOverrides, LIVE_OVERRIDES } from "@/lib/live-overrides"
import { toAlpha3, toAlpha2, flagFromAlpha2 } from "@/lib/country-codes"
import { COUNTRY_COORDS } from "@/data/countryCoords"
import { alerts as crisisAlerts } from "@/data/alerts"
import { countries as staticCountries } from "@/data/countries"
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

/** Ensure history ends with today's live value and spans exactly 30 days */
function ensureCurrent(hist: KpiDataPoint[], liveValue: number): KpiDataPoint[] {
  const today = new Date().toISOString().slice(0, 10)
  const points = [...hist]

  // Append or update today's point with the live value
  if (points.length === 0) {
    points.push({ date: today, value: liveValue })
  } else if (points[points.length - 1].date !== today) {
    points.push({ date: today, value: liveValue })
  } else {
    points[points.length - 1] = { date: today, value: liveValue }
  }

  // Only keep last 30 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffStr)
}

function buildKpis(
  summary: BackendDashboardSummary,
  history: KpiHistoryMap | null,
): KPI[] {
  const gti = summary.globalThreatIndex

  const gtiHist = ensureCurrent(history?.globalThreatIndex ?? [], gti)
  const anomHist = ensureCurrent(history?.activeAnomalies ?? [], summary.activeAnomalies)
  const highHist = ensureCurrent(history?.highPlusCountries ?? [], summary.highPlusCountries)
  const escHist = ensureCurrent(history?.escalationAlerts24h ?? [], summary.escalationAlerts24h)

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
    queryFn: async () => {
      const raw = await fetchDashboardSummary()
      return applyOverrides(raw)
    },
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
    // Prepend breaking crisis alerts (Iran/Israel strikes) on top of backend alerts
    alerts = [...crisisAlerts.filter((a) => a.severity === "CRITICAL"), ...alerts]
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

/** Breaking headlines injected on top of backend headlines */
const CRISIS_HEADLINES: Record<string, Array<{ text: string; source: string }>> = {
  IR: [
    { text: "US, Israel launch major strikes across Iran — missile sites, nuclear facilities, spy agency targeted", source: "Washington Post" },
    { text: "201+ killed across 24 provinces; 85 dead at girls' school in southern Iran", source: "Al Jazeera" },
    { text: "Iran retaliates with strikes on Israel and US bases in Bahrain, UAE, Qatar, Kuwait, Jordan, Saudi Arabia, Iraq", source: "Reuters" },
    { text: "Trump announces 'major combat operations' against Iran, calls for regime change", source: "CNN" },
    { text: "Brent crude spikes past $120/bbl as Strait of Hormuz closure risk hits maximum", source: "Bloomberg" },
  ],
  IL: [
    { text: "Israel launches coordinated strikes on Iran alongside US forces — explosions across Tehran", source: "Reuters" },
    { text: "Iran retaliates with missile strikes on Israeli cities — Iron Dome and Arrow fully activated", source: "Al Jazeera" },
    { text: "Netanyahu: 'Many signs' Iran's supreme leader is 'no longer with us' after strikes", source: "CBS News" },
  ],
  BH: [
    { text: "Iran strikes US military base in Bahrain in retaliation for US-Israeli attack", source: "Al Jazeera" },
  ],
  AE: [
    { text: "UAE targeted in Iranian retaliatory strikes against US military assets in the Gulf", source: "Reuters" },
  ],
  IQ: [
    { text: "Iranian missiles target US forces in Iraq as regional conflict escalates", source: "AP" },
  ],
  YE: [
    { text: "Houthi forces escalate Red Sea attacks as part of coordinated Iranian retaliation campaign", source: "BBC" },
  ],
  SA: [
    { text: "Saudi Arabia targeted in Iranian retaliation — US assets in Kingdom under attack", source: "Reuters" },
  ],
  LB: [
    { text: "Hezbollah launches strikes on northern Israel in coordination with Iranian offensive", source: "Al Jazeera" },
  ],
}

export function useHeadlines() {
  return useQuery({
    queryKey: ["headlines"],
    queryFn: async () => {
      const data = await fetchHeadlines()
      // Inject crisis headlines on top of backend data
      const merged = { ...data }
      merged.headlines = { ...data.headlines }
      for (const [code, items] of Object.entries(CRISIS_HEADLINES)) {
        const existing = merged.headlines[code] ?? []
        merged.headlines[code] = [...items, ...existing]
      }
      return merged
    },
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    retry: 1,
  })
}

/** Lookup static country data for crisis-override countries (Iran, Israel, etc.)
 *  so the IntelPanel shows our curated briefs/chains/headlines instead of stale backend data */
function getStaticOverride(code3: string): Partial<Country> | null {
  const code2 = toAlpha2(code3)
  if (!code2 || !LIVE_OVERRIDES[code2]) return null
  const sc = staticCountries.find((c) => c.code === code3)
  if (!sc) return null
  return {
    score: sc.score,
    riskLevel: sc.riskLevel,
    confidence: sc.confidence,
    isAnomaly: sc.isAnomaly,
    brief: sc.brief,
    causalChain: sc.causalChain,
    riskDrivers: sc.riskDrivers,
    headlines: sc.headlines,
    exposure: sc.exposure,
    recommendations: sc.recommendations,
  }
}

export function useAnalysis(countryCode3: string | null) {
  const code2 = countryCode3 ? toAlpha2(countryCode3) : ""
  const name = countryCode3 ?? ""

  // For crisis-override countries, use static curated data instead of stale backend
  const staticOverride = countryCode3 ? getStaticOverride(countryCode3) : null

  return useQuery({
    queryKey: ["analysis", code2],
    queryFn: () => fetchAnalysis(name, code2),
    enabled: !!countryCode3 && !!code2,
    staleTime: 1000 * 60 * 15,
    retry: 1,
    select: (data: BackendAnalysis): Partial<Country> => {
      const backendResult: Partial<Country> = {
        score: data.mlMetadata.riskScore,
        riskLevel: toRiskLevel(data.mlMetadata.riskLevel),
        confidence: data.mlMetadata.confidence,
        isAnomaly: data.mlMetadata.anomalyDetected,
        brief: data.summary,
        causalChain: data.causalChain.map((s) => ({ event: s.event, probability: s.probability })),
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

      // Override with curated crisis data for countries in LIVE_OVERRIDES
      if (staticOverride) {
        return { ...backendResult, ...staticOverride }
      }
      return backendResult
    },
  })
}

export function useForecast(countryCode3: string | null, currentScore?: number) {
  const code2 = countryCode3 ? toAlpha2(countryCode3) : ""
  const name = countryCode3 ?? ""

  // For crisis countries, use static forecast from countries.ts
  const staticForecast = countryCode3
    ? staticCountries.find((c) => c.code === countryCode3 && LIVE_OVERRIDES[toAlpha2(c.code) ?? ""])
    : null

  return useQuery({
    queryKey: ["forecast", code2],
    queryFn: () => fetchForecast(name, code2),
    enabled: !!countryCode3 && !!code2,
    staleTime: 1000 * 60 * 15,
    retry: 1,
    select: (data): { forecast: ForecastPoint[]; trend: Trend; raw: BackendForecast } => {
      // Use static curated forecast for crisis countries
      if (staticForecast && staticForecast.forecast.length > 0) {
        return {
          forecast: staticForecast.forecast,
          trend: toTrend(staticForecast.forecast[staticForecast.forecast.length - 1].score - staticForecast.score),
          raw: data,
        }
      }

      const now = currentScore ?? data.forecast_30d
      return {
        forecast: [
          { day: 0, score: now },
          { day: 15, score: Math.round((now + data.forecast_30d) / 2) },
          { day: 30, score: data.forecast_30d },
          { day: 45, score: Math.round((data.forecast_30d + data.forecast_60d) / 2) },
          { day: 60, score: data.forecast_60d },
          { day: 75, score: Math.round((data.forecast_60d + data.forecast_90d) / 2) },
          { day: 90, score: data.forecast_90d },
        ],
        trend: toTrend(data.forecast_90d - now),
        raw: data,
      }
    },
  })
}
