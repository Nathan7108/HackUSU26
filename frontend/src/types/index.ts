/* ============================================
   Sentinel AI — Core Types
   ============================================ */

export type RiskLevel = "CRITICAL" | "HIGH" | "ELEVATED" | "MODERATE" | "LOW"
export type Trend = "ESCALATING" | "STABLE" | "DE-ESCALATING"
export type Sentiment = "positive" | "negative" | "neutral"
export type Theme = "light" | "dark" | "midnight"

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
  causalChain: CausalStep[]
  riskDrivers: RiskDriver[]
  forecast: ForecastPoint[]
  headlines: Headline[]
  exposure?: ExposureData
  recommendations?: Recommendation[]
}

export interface CausalStep {
  event: string
  probability: number
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
  trigger: string // "Taiwan risk score hits 78+ (LSTM projects 60 days)"
  costOfInaction: number // in millions — the scary number
  evidence: string // real-world proof with sources
}

// Vessel tracking
export type VesselType = "bulk-carrier" | "container" | "tanker" | "ro-ro" | "general-cargo"

export interface Vessel {
  id: string
  name: string
  type: VesselType
  routeId: string
  cargo: string
  cargoValue: number   // in millions
  insurancePremium: number // in millions
  departurePort: string
  arrivalPort: string
  progressOffset: number // 0–1 stagger within route
  speed: number          // multiplier (1.0 = normal)
}

export interface Alert {
  id: string
  type: "TIER_CHANGE" | "SCORE_SPIKE" | "ANOMALY_DETECTED" | "FORECAST_SHIFT" | "FATALITY_SPIKE" | "ROUTE_DISRUPTION" | "FORECAST_ESCALATION" | "GOVERNANCE_ALERT"
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
