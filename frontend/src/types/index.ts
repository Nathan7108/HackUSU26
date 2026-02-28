/* ============================================
   Sentinel AI — Core Types
   ============================================ */

export type RiskLevel = "CRITICAL" | "HIGH" | "ELEVATED" | "MODERATE" | "LOW"
export type Trend = "ESCALATING" | "STABLE" | "DE-ESCALATING"
export type Sentiment = "positive" | "negative" | "neutral"
export type Theme = "light" | "dark"

export interface Country {
  code: string
  name: string
  flag: string
  score: number
  riskLevel: RiskLevel
  trend: Trend
  trendDelta: number
  confidence: number
  isAnomaly: boolean
  anomalyDriver?: string
  anomalyTime?: string
  lat: number
  lng: number
  brief: string
  causalChain: string[]
  riskDrivers: RiskDriver[]
  forecast: ForecastPoint[]
  headlines: Headline[]
  exposure?: ExposureData
  recommendations?: Recommendation[]
}

export interface RiskDriver {
  feature: string
  importance: number
}

export interface ForecastPoint {
  day: number
  score: number
}

export interface Headline {
  text: string
  sentiment: Sentiment
  source: string
}

// Cascade Precision specific
export interface Facility {
  id: string
  name: string
  location: string
  lat: number
  lng: number
  type: "hq" | "manufacturing" | "processing" | "assembly" | "distribution"
  function: string
  annualValue: number // in millions
}

export interface TradeRoute {
  id: string
  from: Facility
  to: Facility
  chokepoint: string
  riskLevel: RiskLevel
  annualCargo: number // in millions
}

export interface ExposureData {
  totalExposure: number // in millions
  affectedRoutes: string[] // route IDs
  affectedFacilities: string[] // facility IDs
  description: string
}

export interface Recommendation {
  action: string
  description: string
  cost: number // in millions
  riskReduction: number // in millions
  roi: number
  leadTime: string
  priority: "IMMEDIATE" | "SHORT_TERM" | "MEDIUM_TERM"
}

export interface Alert {
  id: string
  type: "TIER_CHANGE" | "SCORE_SPIKE" | "ANOMALY_DETECTED" | "FORECAST_SHIFT"
  severity: RiskLevel
  countryCode: string
  countryName: string
  title: string
  description: string
  timestamp: string
}

export interface KpiDataPoint {
  date: string
  value: number
}

export interface KPI {
  label: string
  value: number
  unit?: string
  trend: Trend
  trendDelta: number
  sparkline?: number[]
  chartData?: KpiDataPoint[]
  chartColor?: string
}

export interface DashboardSummary {
  globalThreatIndex: number
  globalThreatTrend: Trend
  activeAnomalies: number
  highPlusCountries: number
  escalationAlerts24h: number
  modelConfidence: number
  countries: Country[]
  alerts: Alert[]
  kpis: KPI[]
}
