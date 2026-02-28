import { useQuery } from "@tanstack/react-query"
import { COUNTRY_COORDS } from "@/data/countryCoords"
import type { RiskLevel } from "@/types"

const API = import.meta.env.VITE_API_URL as string

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

async function fetchCountries(): Promise<MapCountry[]> {
  const res = await fetch(`${API}/api/countries`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data: ApiCountry[] = await res.json()

  return data
    .map((c) => {
      const coords = COUNTRY_COORDS[c.countryCode]
      if (!coords) return null
      return {
        code: c.countryCode,
        name: c.country,
        score: c.riskScore,
        riskLevel: c.riskLevel,
        isAnomaly: false,
        lat: coords[0],
        lng: coords[1],
      }
    })
    .filter((c): c is MapCountry => c !== null)
}

export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
