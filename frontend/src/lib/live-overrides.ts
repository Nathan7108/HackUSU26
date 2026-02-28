/**
 * Live Crisis Override — US/Israel strikes on Iran, Feb 28 2026
 *
 * These overrides boost country risk scores based on real-time breaking events
 * that our ML pipeline hasn't yet fully ingested (< 24h old).
 * Applied on top of backend XGBoost/LSTM scores.
 *
 * Source: Reuters, AP, Al Jazeera, CNN, BBC — Feb 28 2026
 */

import type { RiskLevel } from "@/types"

export interface ScoreOverride {
  code2: string
  score: number
  riskLevel: RiskLevel
  isAnomaly: boolean
  trendDelta: number
}

/** Country score overrides keyed by 2-letter ISO */
export const LIVE_OVERRIDES: Record<string, ScoreOverride> = {
  // Direct combatants
  IR: { code2: "IR", score: 94, riskLevel: "CRITICAL", isAnomaly: true, trendDelta: 34 },
  IL: { code2: "IL", score: 88, riskLevel: "CRITICAL", isAnomaly: true, trendDelta: 31 },

  // Iran retaliation targets (US bases struck)
  BH: { code2: "BH", score: 76, riskLevel: "HIGH", isAnomaly: true, trendDelta: 28 },
  AE: { code2: "AE", score: 72, riskLevel: "HIGH", isAnomaly: true, trendDelta: 22 },
  IQ: { code2: "IQ", score: 78, riskLevel: "HIGH", isAnomaly: true, trendDelta: 20 },
  QA: { code2: "QA", score: 65, riskLevel: "ELEVATED", isAnomaly: true, trendDelta: 18 },
  KW: { code2: "KW", score: 64, riskLevel: "ELEVATED", isAnomaly: true, trendDelta: 16 },
  SA: { code2: "SA", score: 62, riskLevel: "ELEVATED", isAnomaly: true, trendDelta: 15 },
  JO: { code2: "JO", score: 58, riskLevel: "ELEVATED", isAnomaly: true, trendDelta: 12 },

  // Conflict theater escalation
  YE: { code2: "YE", score: 89, riskLevel: "CRITICAL", isAnomaly: true, trendDelta: 11 },
  LB: { code2: "LB", score: 74, riskLevel: "HIGH", isAnomaly: true, trendDelta: 19 },
}

/** Override GTI — active conflict in the Gulf pushes global index up */
export const GTI_BOOST = 14

/** Names for override-injected countries not in the backend */
const OVERRIDE_NAMES: Record<string, string> = {
  IR: "Iran", IL: "Israel", BH: "Bahrain", AE: "UAE", IQ: "Iraq",
  QA: "Qatar", KW: "Kuwait", SA: "Saudi Arabia", JO: "Jordan",
  YE: "Yemen", LB: "Lebanon",
}

type BackendCountryRow = {
  code: string
  name: string
  riskScore: number
  riskLevel: string
  isAnomaly: boolean
  anomalyScore: number
  scoreDelta: number
}

/**
 * Apply live overrides to a backend dashboard summary.
 * Patches country scores, injects missing countries, recalculates GTI.
 */
export function applyOverrides<T extends {
  globalThreatIndex: number
  globalThreatIndexDelta: number
  activeAnomalies: number
  highPlusCountries: number
  escalationAlerts24h: number
  countries: BackendCountryRow[]
}>(summary: T): T {
  const patched = { ...summary }
  const seen = new Set<string>()

  const countries: BackendCountryRow[] = patched.countries.map((c) => {
    seen.add(c.code)
    const override = LIVE_OVERRIDES[c.code]
    if (!override) return c
    return {
      ...c,
      riskScore: Math.max(c.riskScore, override.score),
      riskLevel: override.riskLevel,
      isAnomaly: override.isAnomaly,
      anomalyScore: override.isAnomaly ? 0.95 : c.anomalyScore,
      scoreDelta: override.trendDelta,
    }
  })

  // Inject override countries missing from backend
  for (const [code2, ov] of Object.entries(LIVE_OVERRIDES)) {
    if (seen.has(code2)) continue
    countries.push({
      code: code2,
      name: OVERRIDE_NAMES[code2] ?? code2,
      riskScore: ov.score,
      riskLevel: ov.riskLevel,
      isAnomaly: ov.isAnomaly,
      anomalyScore: 0.95,
      scoreDelta: ov.trendDelta,
    })
  }

  patched.countries = countries
  patched.globalThreatIndex = Math.min(99, patched.globalThreatIndex + GTI_BOOST)
  patched.globalThreatIndexDelta = patched.globalThreatIndexDelta + GTI_BOOST
  patched.activeAnomalies = countries.filter((c) => c.isAnomaly).length
  patched.highPlusCountries = countries.filter(
    (c) => c.riskLevel === "CRITICAL" || c.riskLevel === "HIGH",
  ).length
  patched.escalationAlerts24h = Math.max(patched.escalationAlerts24h, 12)

  return patched
}
