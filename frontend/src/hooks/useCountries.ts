import { useQuery } from "@tanstack/react-query"
import { COUNTRY_COORDS } from "@/data/countryCoords"
import type { RiskLevel } from "@/types"
import { LIVE_OVERRIDES } from "@/lib/live-overrides"

// In dev, use relative URL so Vite proxy handles it (avoids CORS / mixed-content)
const API = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || "https://hackusu26-production.up.railway.app")
  : ""

interface ApiCountry {
  countryCode: string
  country: string
  riskScore: number
  riskLevel: RiskLevel
}

export interface MapCountry {
  code: string
  name: string
  score: number
  riskLevel: RiskLevel
  isAnomaly: boolean
  lat: number
  lng: number
}

/** Names for override-injected countries not in the backend */
const OVERRIDE_NAMES: Record<string, string> = {
  IR: "Iran", IL: "Israel", BH: "Bahrain", AE: "UAE", IQ: "Iraq",
  QA: "Qatar", KW: "Kuwait", SA: "Saudi Arabia", JO: "Jordan",
  YE: "Yemen", LB: "Lebanon",
}

async function fetchCountries(): Promise<MapCountry[]> {
  const res = await fetch(`${API}/api/countries`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data: ApiCountry[] = await res.json()

  const seen = new Set<string>()
  const results = data
    .map((c) => {
      const coords = COUNTRY_COORDS[c.countryCode]
      if (!coords) return null
      seen.add(c.countryCode)
      const override = LIVE_OVERRIDES[c.countryCode]
      return {
        code: c.countryCode,
        name: c.country,
        score: override ? Math.max(c.riskScore, override.score) : c.riskScore,
        riskLevel: override ? override.riskLevel : c.riskLevel,
        isAnomaly: override ? override.isAnomaly : false,
        lat: coords[0],
        lng: coords[1],
      }
    })
    .filter((c): c is MapCountry => c !== null)

  // Inject override countries missing from backend (Gulf states, Lebanon, etc.)
  for (const [code2, ov] of Object.entries(LIVE_OVERRIDES)) {
    if (seen.has(code2)) continue
    const coords = COUNTRY_COORDS[code2]
    if (!coords) continue
    results.push({
      code: code2,
      name: OVERRIDE_NAMES[code2] ?? code2,
      score: ov.score,
      riskLevel: ov.riskLevel,
      isAnomaly: ov.isAnomaly,
      lat: coords[0],
      lng: coords[1],
    })
  }

  return results
}

export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
