import type { Alert } from "@/types"

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export const alerts: Alert[] = [
  // ── BREAKING: Iran Crisis — Feb 28 2026 ──────────────────────
  {
    id: "b1",
    type: "TIER_CHANGE",
    severity: "CRITICAL",
    countryCode: "IRN",
    countryName: "Iran",
    title: "BREAKING: US/Israel launch major strikes on Iran",
    description: "Coordinated US-Israeli military strikes across Iran targeting missile sites, nuclear facilities, and IRGC intelligence HQ. 201+ reported killed across 24 provinces. Score surged 60 → 94 CRITICAL.",
    timestamp: ago(12),
  },
  {
    id: "b2",
    type: "SCORE_SPIKE",
    severity: "CRITICAL",
    countryCode: "IRN",
    countryName: "Iran",
    title: "Iran retaliates — strikes on US bases in 7 Arab states",
    description: "Iran launched retaliatory strikes on Israel and US military bases in Bahrain, UAE, Qatar, Kuwait, Jordan, Saudi Arabia, and Iraq. Strait of Hormuz transit effectively suspended.",
    timestamp: ago(8),
  },
  {
    id: "b3",
    type: "TIER_CHANGE",
    severity: "CRITICAL",
    countryCode: "ISR",
    countryName: "Israel",
    title: "Israel CRITICAL (88) — active strikes on Iran, incoming missiles",
    description: "Israel launched strikes alongside US. Iran retaliating with missiles on Israeli cities. Iron Dome and Arrow fully activated. Netanyahu claims supreme leader may be eliminated.",
    timestamp: ago(10),
  },
  {
    id: "b4",
    type: "ROUTE_DISRUPTION",
    severity: "CRITICAL",
    countryCode: "IRN",
    countryName: "Iran",
    title: "DUAL CHOKEPOINT FAILURE: Hormuz + Red Sea both compromised",
    description: "Strait of Hormuz transit suspended due to active strikes. Red Sea already compromised by Houthi attacks. No safe sea route Asia→Europe. Cascade exposure: $1.1B+.",
    timestamp: ago(6),
  },
  {
    id: "b5",
    type: "ANOMALY_DETECTED",
    severity: "CRITICAL",
    countryCode: "YEM",
    countryName: "Yemen",
    title: "Houthi forces escalate as part of Iran retaliation",
    description: "Houthi forces join Iranian retaliation campaign. Red Sea attacks intensify. Score 78 → 89 CRITICAL. All Suez-bound shipping at maximum risk.",
    timestamp: ago(5),
  },
  {
    id: "b6",
    type: "SCORE_SPIKE",
    severity: "HIGH",
    countryCode: "IRN",
    countryName: "Iran",
    title: "Brent crude spikes past $120/bbl on Hormuz closure risk",
    description: "Oil markets in crisis. 20% of global oil transits Hormuz. Shipping insurance for Gulf transit suspended by major underwriters. Cascade fuel and logistics costs spiking.",
    timestamp: ago(4),
  },

  // ── Existing alerts (pre-crisis context) ─────────────────────
  {
    id: "a1",
    type: "ANOMALY_DETECTED",
    severity: "CRITICAL",
    countryCode: "CHN",
    countryName: "China",
    title: "Rare earth export anomaly detected",
    description: "Yttrium prices surged 60%. Isolation Forest flagged rare_earth_export_controls with anomaly score 0.89. Score 42 ELEVATED.",
    timestamp: ago(120),
  },
  {
    id: "a2",
    type: "SCORE_SPIKE",
    severity: "CRITICAL",
    countryCode: "UKR",
    countryName: "Ukraine",
    title: "Ukraine risk score spike +3.8",
    description: "340% increase in GDELT conflict-coded events. 47 new ACLED battle events in Donetsk. Score 81 CRITICAL.",
    timestamp: ago(180),
  },
  {
    id: "a4",
    type: "FORECAST_SHIFT",
    severity: "ELEVATED",
    countryCode: "TWN",
    countryName: "Taiwan",
    title: "Taiwan 60-day forecast: MODERATE → projected HIGH",
    description: "LSTM projects score reaching 65+ within 60 days. PLA exercises intensifying — Sentinel flagged 3 weeks before consensus.",
    timestamp: ago(220),
  },
]
