import type { Vessel } from "@/types"

/* ─── Voyage durations (days) per route ───────────────────── */
export const VOYAGE_DAYS: Record<string, number> = {
  r1: 3, r2: 2, r3: 5, r4: 21, r5: 1, r6: 14, r7: 1, r8: 18, r9: 12, r10: 33,
}

/* ─── Chokepoints for proximity detection ─────────────────── */
const CHOKEPOINT_ZONES = [
  { name: "TAIWAN STRAIT", lng: 119.5, lat: 24.5 },
  { name: "MALACCA STRAIT", lng: 101.0, lat: 2.5 },
  { name: "BAB EL-MANDEB", lng: 43.3, lat: 12.6 },
  { name: "SUEZ CANAL", lng: 32.3, lat: 30.5 },
  { name: "STRAIT OF HORMUZ", lng: 56.3, lat: 26.5 },
  { name: "SOUTH CHINA SEA", lng: 115.0, lat: 14.5 },
  { name: "CAPE OF GOOD HOPE", lng: 18.5, lat: -34.4 },
  { name: "STRAIT OF GIBRALTAR", lng: -5.6, lat: 36.0 },
]

const CHOKEPOINT_RADIUS_DEG = 3.0

/* ─── Interpolate along a spline at progress [0,1] ───────── */
export function interpolateSpline(
  spline: [number, number][],
  progress: number,
): { lng: number; lat: number; heading: number } {
  const t = Math.max(0, Math.min(1, progress))
  const idx = t * (spline.length - 1)
  const i = Math.floor(idx)
  const frac = idx - i

  if (i >= spline.length - 1) {
    // At end — compute heading from last segment
    const prev = spline[spline.length - 2]
    const last = spline[spline.length - 1]
    return {
      lng: last[0], lat: last[1],
      heading: bearing(prev[0], prev[1], last[0], last[1]),
    }
  }

  const a = spline[i]
  const b = spline[i + 1]
  return {
    lng: a[0] + (b[0] - a[0]) * frac,
    lat: a[1] + (b[1] - a[1]) * frac,
    heading: bearing(a[0], a[1], b[0], b[1]),
  }
}

/* ─── Bearing in degrees (0=north, CW) ───────────────────── */
function bearing(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/* ─── Chokepoint proximity check ─────────────────────────── */
export function checkChokepointProximity(
  lng: number,
  lat: number,
): { hit: boolean; name?: string } {
  // Normalize lng to [-180, 180] for chokepoint comparison
  let normLng = lng % 360
  if (normLng > 180) normLng -= 360
  if (normLng < -180) normLng += 360

  for (const cp of CHOKEPOINT_ZONES) {
    const dLng = normLng - cp.lng
    const dLat = lat - cp.lat
    if (dLng * dLng + dLat * dLat <= CHOKEPOINT_RADIUS_DEG * CHOKEPOINT_RADIUS_DEG) {
      return { hit: true, name: cp.name }
    }
  }
  return { hit: false }
}

/* ─── Ship icon SVG (top-down silhouette) ────────────────── */
export function createShipIconSvg(): string {
  // Simple top-down cargo ship silhouette pointing UP (bearing 0)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M12 2 L8 8 L8 18 L10 22 L14 22 L16 18 L16 8 Z" fill="white"/>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ─── Build GeoJSON FeatureCollection for vessel symbol layer */
export function buildVesselGeoJSON(
  vessels: Vessel[],
  progressMap: Map<string, number>,
  routeSplines: Map<string, [number, number][]>,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const v of vessels) {
    const spline = routeSplines.get(v.routeId)
    if (!spline || spline.length < 2) continue
    const progress = progressMap.get(v.id) ?? v.progressOffset
    const pos = interpolateSpline(spline, progress)
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pos.lng, pos.lat] },
      properties: {
        id: v.id,
        name: v.name,
        heading: pos.heading,
        riskColor: ROUTE_RISK[v.routeId] ?? "#22c55e",
      },
    })
  }
  return { type: "FeatureCollection", features }
}

/* ─── Format ETA string ──────────────────────────────────── */
export function formatEta(progress: number, routeId: string): string {
  const totalDays = VOYAGE_DAYS[routeId] ?? 10
  const remaining = totalDays * (1 - Math.max(0, Math.min(1, progress)))
  if (remaining < 0.05) return "Arriving"
  if (remaining < 1) return `~${(remaining * 24).toFixed(0)}h`
  return `~${remaining.toFixed(1)} days`
}

/* ─── Vessel type label ──────────────────────────────────── */
const VESSEL_TYPE_LABEL: Record<string, string> = {
  "bulk-carrier": "Bulk Carrier",
  container: "Container Ship",
  tanker: "Tanker",
  "ro-ro": "Ro-Ro Carrier",
  "general-cargo": "General Cargo",
}

export function vesselTypeLabel(type: string): string {
  return VESSEL_TYPE_LABEL[type] ?? type
}

/* ─── Route risk color lookup ─────────────────────────────── */
export const ROUTE_RISK: Record<string, string> = {
  r1: "#f97316", r2: "#eab308", r3: "#eab308",
  r4: "#f97316", r5: "#22c55e", r6: "#22c55e",
  r7: "#22c55e", r8: "#eab308", r9: "#22c55e", r10: "#22c55e",
}

/* ─── Route chokepoint names (ordered by position on route) ── */
const ROUTE_CHOKEPOINTS: Record<string, string[]> = {
  r1: ["Taiwan Strait"],
  r2: ["East China Sea"],
  r3: ["South China Sea"],
  r4: ["Malacca Strait", "Bab el-Mandeb", "Suez Canal"],
  r5: [],
  r6: [],
  r7: [],
  r8: [],
  r9: [],
  r10: ["Cape of Good Hope"],
}

/* ─── Location-aware vessel brief ────────────────────────── */
export function getVesselBrief(
  progress: number,
  routeId: string,
  lng: number,
  lat: number,
  departurePort: string,
  arrivalPort: string,
): { brief: string; status: string; statusColor: string } {
  const choke = checkChokepointProximity(lng, lat)
  const chokepoints = ROUTE_CHOKEPOINTS[routeId] ?? []

  // Currently in a chokepoint zone
  if (choke.hit) {
    return {
      brief: `Transiting ${choke.name} — elevated risk zone`,
      status: "TRANSITING CONFLICT ZONE",
      statusColor: "#ef4444",
    }
  }

  // Departure phase
  if (progress < 0.08) {
    return {
      brief: `Departed ${departurePort}, entering shipping lane`,
      status: "UNDERWAY",
      statusColor: "#3b82f6",
    }
  }

  // Arrival phase
  if (progress > 0.92) {
    return {
      brief: `Approaching ${arrivalPort}, final leg`,
      status: "ARRIVING",
      statusColor: "#22c55e",
    }
  }

  // Mid-route: check if the route has chokepoints and give context
  if (chokepoints.length > 0) {
    // Estimate which chokepoint(s) are ahead vs behind based on progress
    const segSize = 1 / (chokepoints.length + 1)
    for (let i = 0; i < chokepoints.length; i++) {
      const cpProgress = segSize * (i + 1)
      if (progress < cpProgress - 0.08) {
        return {
          brief: `En route — approaching ${chokepoints[i]}`,
          status: "EN ROUTE",
          statusColor: "#eab308",
        }
      }
      if (progress < cpProgress + 0.08) {
        // Very close — about to enter
        return {
          brief: `Nearing ${chokepoints[i]} — insurance surcharge active`,
          status: "ELEVATED RISK",
          statusColor: "#f97316",
        }
      }
    }
    // Past all chokepoints
    return {
      brief: `Cleared ${chokepoints[chokepoints.length - 1]} — open water`,
      status: "CLEARED",
      statusColor: "#22c55e",
    }
  }

  // Safe route, open water
  const pct = Math.round(progress * 100)
  return {
    brief: `In open waters — ${pct}% of voyage complete`,
    status: "EN ROUTE",
    statusColor: "#3b82f6",
  }
}
