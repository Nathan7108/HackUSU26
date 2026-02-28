/**
 * Sentinel AI — API client
 * Centralized fetch wrappers for all backend endpoints.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

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

export interface BackendKpiHistory {
  history: Array<{
    date: string
    globalThreatIndex: number
    activeAnomalies: number
    highPlusCountries: number
    escalationAlerts24h: number
  }>
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

// ── API functions ───────────────────────────────────────────────

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

export function fetchHealth(): Promise<Record<string, unknown>> {
  return apiFetch("/health")
}
