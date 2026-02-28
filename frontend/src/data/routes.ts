import type { TradeRoute, RiskLevel } from "@/types"
import { getFacilityById } from "./facilities"

interface RawRoute {
  id: string
  fromId: string
  toId: string
  chokepoint: string
  riskLevel: RiskLevel
  annualCargo: number
}

const rawRoutes: RawRoute[] = [
  { id: "r1", fromId: "baotou", toId: "hsinchu", chokepoint: "Taiwan Strait", riskLevel: "HIGH", annualCargo: 420 },
  { id: "r2", fromId: "hsinchu", toId: "nagoya", chokepoint: "East China Sea", riskLevel: "ELEVATED", annualCargo: 680 },
  { id: "r3", fromId: "nagoya", toId: "singapore", chokepoint: "South China Sea", riskLevel: "ELEVATED", annualCargo: 290 },
  { id: "r4", fromId: "singapore", toId: "rotterdam", chokepoint: "Malacca + Suez + Bab el-Mandeb", riskLevel: "HIGH", annualCargo: 720 },
  { id: "r5", fromId: "rotterdam", toId: "toulouse", chokepoint: "European inland", riskLevel: "LOW", annualCargo: 620 },
  { id: "r6", fromId: "rotterdam", toId: "portland", chokepoint: "Transatlantic", riskLevel: "LOW", annualCargo: 540 },
  { id: "r7", fromId: "vicenza", toId: "toulouse", chokepoint: "European inland", riskLevel: "LOW", annualCargo: 340 },
  { id: "r8", fromId: "baotou", toId: "portland", chokepoint: "Trans-Pacific", riskLevel: "ELEVATED", annualCargo: 420 },
  { id: "r9", fromId: "toulouse", toId: "portland", chokepoint: "Transatlantic", riskLevel: "LOW", annualCargo: 620 },
  { id: "r10", fromId: "singapore", toId: "rotterdam", chokepoint: "Cape of Good Hope", riskLevel: "LOW", annualCargo: 380 },
]

export const tradeRoutes: TradeRoute[] = rawRoutes.map((r) => ({
  id: r.id,
  from: getFacilityById(r.fromId)!,
  to: getFacilityById(r.toId)!,
  chokepoint: r.chokepoint,
  riskLevel: r.riskLevel,
  annualCargo: r.annualCargo,
}))

export function getRoutesByRisk(level: RiskLevel): TradeRoute[] {
  return tradeRoutes.filter((r) => r.riskLevel === level)
}

export function getRoutesForCountry(countryCode: string): TradeRoute[] {
  const countryFacilityMap: Record<string, string[]> = {
    TWN: ["hsinchu"],
    CHN: ["baotou"],
    JPN: ["nagoya"],
    SGP: ["singapore"],
    NLD: ["rotterdam"],
    FRA: ["toulouse"],
    ITA: ["vicenza"],
    USA: ["portland"],
  }
  const facilityIds = countryFacilityMap[countryCode] ?? []
  return tradeRoutes.filter(
    (r) => facilityIds.includes(r.from.id) || facilityIds.includes(r.to.id),
  )
}
