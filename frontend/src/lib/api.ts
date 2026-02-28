/**
 * Sentinel AI — API client
 * Centralized fetch wrappers for all backend endpoints.
 */

// In dev, use relative URLs so Vite's proxy handles routing (avoids CORS / mixed-content).
// In production, set VITE_API_URL to the actual backend origin.
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL ?? "")
  : ""

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

// ── Response types (mirror backend shapes) ─────────────────────

export interface BackendCountryRow {
  code: string        // 2-letter ISO
  name: string
  riskScore: number
  riskLevel: string
  isAnomaly: boolean
  anomalyScore: number
  scoreDelta: number
}

export interface BackendDashboardSummary {
  globalThreatIndex: number
  globalThreatIndexDelta: number
  activeAnomalies: number
  highPlusCountries: number
  highPlusCountriesDelta: number
  escalationAlerts24h: number
  modelHealth: number
  countries: BackendCountryRow[]
  computedAt: string
  dataAsOf: string
  dataSources: {
    total: number
    domains: number
    pipeline: string[]
    status: Record<string, number>
  }
  totalMonitored: number
}

export interface BackendAlert {
  type: string
  country: string     // name, not code
  code: string        // 2-letter
  detail: string
  time: string
  severity: string
}

export interface BackendKpiHistoryMetric {
  period: string
  values: Array<{ date: string; value: number }>
}

export interface BackendKpiHistory {
  globalThreatIndex: BackendKpiHistoryMetric
  activeAnomalies: BackendKpiHistoryMetric
  highPlusCountries: BackendKpiHistoryMetric
  escalationAlerts24h: BackendKpiHistoryMetric
}

export interface BackendCausalChainStep {
  step: number
  event: string
  probability: number
}

export interface BackendAnalysis {
  riskScore: number
  riskLevel: string
  summary: string
  keyFactors: string[]
  industries: string[]
  watchList: string[]
  causalChain: BackendCausalChainStep[]
  cascadeExposure: {
    facility: Record<string, string> | null
    hotspot: Record<string, string> | null
    tradeRoute: string | null
  }
  lastUpdated: string
  mlMetadata: {
    riskScore: number
    confidence: number
    riskLevel: string
    anomalyDetected: boolean
    anomalyScore: number
    sentimentLabel: string
    escalatoryPct: number
    topDrivers: string[]
    dataSources: Record<string, unknown>
    modelVersion: string
  }
}

export interface BackendForecast {
  countryCode: string
  country: string
  forecast_30d: number
  forecast_60d: number
  forecast_90d: number
  trend: string
}

// ── API functions ───────────────────────────────────────────────

export interface ApiCountryListItem {
  countryCode: string   // 2-letter ISO
  country: string       // display name
  riskScore: number
  riskLevel: string
}

export function fetchCountriesList(): Promise<ApiCountryListItem[]> {
  return apiFetch("/api/countries")
}

export function fetchDashboardSummary(): Promise<BackendDashboardSummary> {
  return apiFetch("/api/dashboard/summary?limit=0")
}

export function fetchDashboardAlerts(): Promise<{ alerts: BackendAlert[] }> {
  return apiFetch("/api/dashboard/alerts")
}

export function fetchKpiHistory(): Promise<BackendKpiHistory> {
  return apiFetch("/api/dashboard/kpis/history")
}

export function fetchAnalysis(country: string, countryCode: string): Promise<BackendAnalysis> {
  return apiFetch("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ country, countryCode }),
  })
}

export function fetchForecast(country: string, countryCode: string): Promise<BackendForecast> {
  return apiFetch("/api/forecast", {
    method: "POST",
    body: JSON.stringify({ country, countryCode }),
  })
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch("/health")
}

export function fetchTrackRecord(): Promise<TrackRecordResponse> {
  return apiFetch("/api/track-record")
}

export interface HealthResponse {
  status: string
  api: boolean
  ml: boolean
  version: string
  uptime: string
  uptimeSeconds: number
  models: {
    riskScorer: { ready: boolean; type: string; features: number }
    anomalyDetection: { ready: boolean; type: string; countryModels: number }
    forecaster: { ready: boolean; type: string; horizons: string[] }
    sentiment: { type: string; model: string }
  }
  data: {
    countriesScored: number
    countriesTotal: number
    coveragePct: number
    lastComputed: string | null
    refreshIntervalMinutes: number
    sources: Record<string, number>
  }
}

export interface TrackRecordPrediction {
  country_code: string
  predicted_at: string
  risk_level: string
  risk_score: number
  confidence: number
  model_version: string
  actual_risk_level: string | null
  prediction_correct: number | null
}

export interface TrackRecordResponse {
  predictions: TrackRecordPrediction[]
  accuracy: {
    total_evaluated: number
    correct: number
    accuracy_pct: number
    days_back: number
  }
}

// ── Live Feeds types ──────────────────────────────────────────

export interface USGSEvent {
  magnitude: number
  place: string
  time: string
  lat: number
  lng: number
  depth_km: number
  url: string
}

export interface GDACSAlert {
  eventType: string
  name: string
  alertLevel: string // "Green" | "Orange" | "Red"
  country: string
  date: string
  severity: string | null
  lat: number
  lng: number
}

export interface ReliefWebReport {
  title: string
  date: string
  countries: string[]
  sources: string[]
  url: string
}

export interface OONIIncident {
  title: string
  shortDescription: string
  startTime: string
  endTime: string | null
  ASNs: number[]
  CCs: string[]
  published: boolean
}

export interface NASAEvent {
  title: string
  categories: string[]
  date: string
  lat: number
  lng: number
  link: string
}

export interface LiveFeedsResponse {
  usgs_earthquakes: { source: string; count: number; events: USGSEvent[]; fetchedAt: string }
  gdacs_alerts: { source: string; count: number; alerts: GDACSAlert[]; fetchedAt: string }
  reliefweb_reports: { source: string; count: number; reports: ReliefWebReport[]; fetchedAt: string }
  ooni_censorship: { source: string; count: number; incidents: OONIIncident[]; fetchedAt: string }
  nasa_eonet: { source: string; count: number; events: NASAEvent[]; fetchedAt: string }
}

export interface DataSourcesResponse {
  total: number
  categories: number
  liveFeeds: LiveFeedsResponse
  fetchedAt: string
}

export function fetchDataSources(): Promise<DataSourcesResponse> {
  return apiFetch("/api/data-sources")
}

export function fetchRecentActivity(): Promise<{ items: Array<{ time: string; icon: string; label: string; detail: string }> }> {
  return apiFetch("/api/recent-activity")
}

// ── Exposure endpoint ──────────────────────────────────────────

export interface BackendFacility {
  id: string
  name: string
  location: string
  lat: number
  lng: number
  type: string
  function: string
  annualValue: number
}

export interface BackendRoute {
  id: string
  from: string
  to: string
  fromName: string
  toName: string
  chokepoint: string
  riskLevel: string
  annualCargo: number
}

export interface BackendCountryExposure {
  countryCode: string
  countryName: string
  totalExposure: number
  riskLevel: string
  riskSource: string
  affectedFacilities: string[]
  affectedRoutes: string[]
  description: string
}

export interface BackendExposureResponse {
  company: string
  totalRevenue: number
  totalExposure: number
  facilities: BackendFacility[]
  routes: BackendRoute[]
  countryExposure: Record<string, BackendCountryExposure>
  computedAt: string
}

export function fetchExposure(): Promise<BackendExposureResponse> {
  return apiFetch("/api/exposure")
}

// ── Recommendations endpoint ───────────────────────────────────

export interface BackendRecommendation {
  countryCode: string
  countryName: string
  riskScore: number
  riskLevel: string
  exposure: number
  industries: string[]
  watch: string[]
  action: string
  description: string
  cost: number
  riskReduction: number
  roi: number
  leadTime: string
  priority: string
  trigger: string
  costOfInaction: number
  evidence: string
}

export interface BackendRecommendationsResponse {
  company: string
  totalRecommendations: number
  recommendations: BackendRecommendation[]
  computedAt: string
}

export function fetchRecommendations(): Promise<BackendRecommendationsResponse> {
  return apiFetch("/api/recommendations")
}

// ── Headlines endpoint ─────────────────────────────────────────

export interface BackendHeadlinesResponse {
  headlines: Record<string, Array<{ text: string; source: string }>>
  cached: boolean
  fetchedAt: string
}

export function fetchHeadlines(): Promise<BackendHeadlinesResponse> {
  return apiFetch("/api/headlines")
}
