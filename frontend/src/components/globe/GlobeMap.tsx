import { useRef, useEffect, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useAppStore } from "@/stores/app"
import { useThemeStore } from "@/stores/theme"
import { facilities, tradeRoutes, VESSELS } from "@/data"
import { useCountries, type MapCountry } from "@/hooks/useCountries"
import { COUNTRY_COORDS } from "@/data/countryCoords"
import { Factory, AlertTriangle, Ship, ChevronDown, Eye, EyeOff } from "lucide-react"
import {
  interpolateSpline, checkChokepointProximity, formatEta,
  vesselTypeLabel, getVesselBrief, ROUTE_RISK,
} from "@/lib/vessel-animation"

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string


const RISK: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", ELEVATED: "#eab308",
  MODERATE: "#3b82f6", LOW: "#22c55e",
}
const RISK_FILL: Record<string, string> = {
  CRITICAL: "rgba(239, 68, 68, 0.85)",
  HIGH:     "rgba(249, 115, 22, 0.75)",
  ELEVATED: "rgba(234, 179, 8, 0.65)",
  MODERATE: "rgba(59, 130, 246, 0.55)",
  LOW:      "rgba(34, 197, 94, 0.45)",
}
const RISK_BORDER: Record<string, string> = {
  CRITICAL: "rgba(239, 68, 68, 1.0)",
  HIGH:     "rgba(249, 115, 22, 0.9)",
  ELEVATED: "rgba(234, 179, 8, 0.7)",
  MODERATE: "rgba(59, 130, 246, 0.6)",
  LOW:      "rgba(34, 197, 94, 0.5)",
}
const FAC_COLOR: Record<string, string> = {
  hq: "#60a5fa", manufacturing: "#34d399", processing: "#fbbf24",
  assembly: "#a78bfa", distribution: "#94a3b8",
}
const RISK_PRIORITY: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, ELEVATED: 2, MODERATE: 3, LOW: 4,
}
const ISO3_TO_2: Record<string, string> = {
  TWN: "TW", CHN: "CN", RUS: "RU", YEM: "YE", IRN: "IR",
  EGY: "EG", ISR: "IL", PHL: "PH", JPN: "JP", KOR: "KR",
  UKR: "UA", USA: "US", FRA: "FR", ITA: "IT", NLD: "NL",
  SGP: "SG", DEU: "DE", GBR: "GB", AUS: "AU", IND: "IN",
  BRA: "BR", MEX: "MX", TUR: "TR", SAU: "SA", PAK: "PK",
  IDN: "ID", THA: "TH", VNM: "VN", MMR: "MM", SYR: "SY",
  IRQ: "IQ", AFG: "AF", LBY: "LY", SDN: "SD", SOM: "SO",
  COD: "CD", NGA: "NG", ETH: "ET", MLI: "ML", VEN: "VE",
  COL: "CO", MYS: "MY", BGD: "BD", LKA: "LK", NPL: "NP",
  // Gulf states + Lebanon (Iran crisis retaliation targets)
  BHR: "BH", ARE: "AE", QAT: "QA", KWT: "KW", JOR: "JO", LBN: "LB",
}
const WAYPOINTS: Record<string, [number, number][]> = {
  // Baotou → Hsinchu (overland China → coastal → Taiwan Strait)
  r1: [[109.84,40.66],[112,36],[116,33],[119.5,30],[121,27],[120.97,24.8]],
  // Hsinchu → Nagoya (East China Sea, stay well offshore)
  r2: [[120.97,24.8],[123,26],[126,28],[129.5,30.5],[133,32.5],[136.91,35.18]],
  // Nagoya → Singapore (swing east of Japan, pass east of Philippines in open Pacific, then west into SCS)
  r3: [[136.91,35.18],[137,32],[136,28],[134,24],[132,20],[130,16],[127,11],[121,6],[114,3],[109,2],[103.82,1.35]],
  // Singapore → Rotterdam (Malacca Strait → Indian Ocean → Bab el-Mandeb → Red Sea → Suez → Med)
  r4: [[103.82,1.35],[99,2],[95,4],[88,7],[78,10],[68,13],[58,16],[52,13],[45,12.5],[43.3,12.8],[42.8,14.5],[41,18],[38,22],[35,26],[33,29],[32.3,31.2],[31.5,32],[29,33.5],[25,35.5],[16,38],[10,38.5],[5,38],[-1,37],[-5.5,36],[-9,38],[-6,43],[-3,47],[1,50],[4.48,51.92]],
  // Rotterdam → Toulouse (European overland)
  r5: [[4.48,51.92],[3,49],[2.3,47],[1.44,43.6]],
  // Rotterdam → Portland (North Atlantic, south around Florida, through Gulf of Mexico, up US west coast)
  r6: [[4.48,51.92],[-2,50],[-10,49],[-20,47],[-35,45],[-50,42],[-60,40],[-65,37],[-70,33],[-75,28],[-80,25],[-83,23],[-86,22],[-90,24],[-95,26],[-98,26],[-102,24],[-108,26],[-114,30],[-118,33],[-121,37],[-123,42],[-122.68,45.52]],
  // Vicenza → Toulouse (European overland)
  r7: [[11.54,45.55],[7,45],[4,44.5],[1.44,43.6]],
  // Baotou → Portland (Trans-Pacific, great circle arc over open ocean)
  r8: [[109.84,40.66],[117.7,39],[125,37],[135,36],[145,40],[160,44],[175,47],[190,48],[210,48],[225,47],[235,45.5],[237.32,45.52]],
  // Toulouse → Portland (Atlantic, south of Florida, through Gulf of Mexico, up US west coast)
  r9: [[1.44,43.6],[-3,43],[-10,40],[-18,36],[-30,32],[-45,28],[-55,25],[-63,22],[-70,20],[-75,22],[-80,25],[-83,23],[-86,22],[-90,24],[-95,26],[-98,26],[-102,24],[-108,26],[-114,30],[-118,33],[-121,37],[-123,42],[-122.68,45.52]],
  // Singapore → Rotterdam (Cape of Good Hope, wide arc well offshore east/south Africa)
  r10: [[103.82,1.35],[96,-2],[85,-6],[72,-14],[60,-22],[48,-30],[38,-35],[25,-36],[18,-34.8],[14,-28],[8,-18],[3,-5],[0,8],[-3,20],[-7,32],[-9,37],[-6,42],[-2,47],[2,50],[4.48,51.92]],
}
const CHOKEPOINTS = [
  { name: "TAIWAN STRAIT", lat: 24.5, lng: 119.5, risk: "HIGH" },
  { name: "MALACCA STRAIT", lat: 2.5, lng: 101.0, risk: "HIGH" },
  { name: "BAB EL-MANDEB", lat: 12.6, lng: 43.3, risk: "CRITICAL" },
  { name: "SUEZ CANAL", lat: 30.5, lng: 32.3, risk: "ELEVATED" },
  { name: "STRAIT OF HORMUZ", lat: 26.5, lng: 56.3, risk: "CRITICAL" },
  { name: "SOUTH CHINA SEA", lat: 14.5, lng: 115.0, risk: "ELEVATED" },
  { name: "CAPE OF GOOD HOPE", lat: -34.4, lng: 18.5, risk: "ELEVATED" },
  { name: "STRAIT OF GIBRALTAR", lat: 36.0, lng: -5.6, risk: "LOW" },
]

function catmullRom(pts: [number, number][], seg = 32): [number, number][] {
  if (pts.length < 2) return pts
  const out: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i], p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t
      out.push([
        0.5 * (2*p1[0] + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5 * (2*p1[1] + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

function countryGeoJSON(list: MapCountry[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list.map((c) => ({
      type: "Feature" as const,
      properties: {
        code: c.code, name: c.name, score: c.score, riskLevel: c.riskLevel,
        color: RISK[c.riskLevel] || "#64748b",
        priority: RISK_PRIORITY[c.riskLevel] ?? 4,
        label: `${c.code} ${c.score}`,
      },
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFillColor(countries: MapCountry[], colorMap: Record<string, string>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expr: any[] = ["match", ["get", "iso_3166_1"]]
  for (const c of countries) {
    const color = colorMap[c.riskLevel]
    if (color) expr.push(c.code, color)
  }
  expr.push("rgba(0,0,0,0)")
  return expr
}

function resolveCoords(code: string, apiCountries?: MapCountry[]): [number, number] | null {
  const api = apiCountries?.find((c) => c.code === code)
  if (api) return [api.lng, api.lat]
  const iso2 = ISO3_TO_2[code] || code
  const coords = COUNTRY_COORDS[iso2]
  if (coords) return [coords[1], coords[0]]
  return null
}

// Zoom level per country based on geographic size (large countries zoom out more)
const COUNTRY_ZOOM: Record<string, number> = {
  RUS: 2.2, RU: 2.2,   // Russia
  CAN: 2.5, CA: 2.5,   // Canada
  USA: 3.0, US: 3.0,   // United States
  CHN: 3.2, CN: 3.2,   // China
  BRA: 3.0, BR: 3.0,   // Brazil
  AUS: 3.0, AU: 3.0,   // Australia
  IND: 3.5, IN: 3.5,   // India
  ARG: 3.0, AR: 3.0,   // Argentina
  KAZ: 3.0, KZ: 3.0,   // Kazakhstan
  DZA: 3.5, DZ: 3.5,   // Algeria
  COD: 3.5, CD: 3.5,   // DR Congo
  SAU: 3.5, SA: 3.5,   // Saudi Arabia
  MEX: 3.5, MX: 3.5,   // Mexico
  IDN: 3.5, ID: 3.5,   // Indonesia
  SDN: 3.5, SD: 3.5,   // Sudan
  LBY: 3.5, LY: 3.5,   // Libya
  IRN: 3.8, IR: 3.8,   // Iran
  MNG: 3.5, MN: 3.5,   // Mongolia
  PER: 3.5, PE: 3.5,   // Peru
  TCD: 3.5, TD: 3.5,   // Chad
  NGA: 3.8, NG: 3.8,   // Nigeria
  ETH: 3.8, ET: 3.8,   // Ethiopia
  EGY: 4.0, EG: 4.0,   // Egypt
  TUR: 4.0, TR: 4.0,   // Turkey
  UKR: 4.0, UA: 4.0,   // Ukraine
  PAK: 4.0, PK: 4.0,   // Pakistan
  COL: 3.8, CO: 3.8,   // Colombia
}
function zoomForCountry(code: string): number {
  return COUNTRY_ZOOM[code] ?? 5.0
}

/* ─── SDF icons from Lucide SVG paths (Path2D, crisp vectors) ── */
function loadMarkerIcons(m: mapboxgl.Map) {
  const S = 128, R = 4, PAD = 8
  const sc = (S - PAD * 2) / 24 // scale 24x24 Lucide viewBox → 128px canvas

  const make = () => {
    const c = document.createElement("canvas"); c.width = S; c.height = S
    const ctx = c.getContext("2d")!
    ctx.translate(PAD, PAD)
    ctx.scale(sc, sc)
    ctx.fillStyle = "#fff"
    ctx.strokeStyle = "#fff"
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    return ctx
  }

  // Factory (Lucide "factory" icon — stroke only, matches key)
  {
    const ctx = make()
    ctx.lineWidth = 1.8
    const body = new Path2D("M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z")
    ctx.stroke(body)
    for (const d of ["M17 20v-4", "M13 20v-4", "M9 20v-4"]) {
      const p = new Path2D(d); ctx.stroke(p)
    }
    m.addImage("mk-factory", ctx.getImageData(0, 0, S, S), { sdf: true, pixelRatio: R })
  }

  // Ship (Lucide "ship" icon — stroke only, matches key)
  {
    const ctx = make()
    ctx.lineWidth = 1.8
    const hull = new Path2D("M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76")
    ctx.stroke(hull)
    const cabin = new Path2D("M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6")
    ctx.stroke(cabin)
    const mast = new Path2D("M12 10V4.5a.5.5 0 0 1 1 0v.2a.8.8 0 0 0 .4.7l.5.3")
    ctx.stroke(mast)
    const waves = new Path2D("M2 21c.6.5 1.2 1 2.5 1a4.7 4.7 0 0 0 3.5-1.5 4.7 4.7 0 0 0 3.5 1.5 4.7 4.7 0 0 0 3.5-1.5 4.7 4.7 0 0 0 3.5 1.5c1.3 0 1.9-.5 2.5-1")
    ctx.stroke(waves)
    m.addImage("mk-ship", ctx.getImageData(0, 0, S, S), { sdf: true, pixelRatio: R })
  }

  // Warning triangle (Lucide "triangle-alert" — stroke only, matches key)
  {
    const ctx = make()
    ctx.lineWidth = 1.8
    const tri = new Path2D("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z")
    ctx.stroke(tri)
    const stem = new Path2D("M12 9v4"); ctx.stroke(stem)
    ctx.beginPath(); ctx.arc(12, 17, 1.3, 0, Math.PI * 2); ctx.fill()
    m.addImage("mk-warning", ctx.getImageData(0, 0, S, S), { sdf: true, pixelRatio: R })
  }
}

function facilityGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => {
      const valStr = f.annualValue >= 1000
        ? `$${(f.annualValue / 1000).toFixed(1)}B`
        : f.annualValue > 0 ? `$${f.annualValue}M` : "Hub"
      return {
        type: "Feature" as const,
        properties: {
          id: f.id, name: f.name, location: f.location, function: f.function, type: f.type,
          color: FAC_COLOR[f.type] || "#94a3b8", valStr, label: f.location.split(",")[0],
        },
        geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
      }
    }),
  }
}

function chokepointGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: CHOKEPOINTS.map((chk) => ({
      type: "Feature" as const,
      properties: { name: chk.name, risk: chk.risk, color: RISK[chk.risk] || "#f97316", label: chk.name },
      geometry: { type: "Point" as const, coordinates: [chk.lng, chk.lat] },
    })),
  }
}

function vesselGeoJSON(splines: Map<string, [number, number][]>): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: VESSELS.map((v) => {
      const spline = splines.get(v.routeId)
      if (!spline || spline.length < 2) return null
      const pos = interpolateSpline(spline, v.progressOffset)
      const color = ROUTE_RISK[v.routeId] ?? "#22c55e"
      const shortName = v.name.replace(/^MV\s+/, "")
      const pct = Math.round(v.progressOffset * 100)
      const eta = formatEta(v.progressOffset, v.routeId)
      const brief = getVesselBrief(v.progressOffset, v.routeId, pos.lng, pos.lat, v.departurePort, v.arrivalPort)
      const choke = checkChokepointProximity(pos.lng, pos.lat)
      return {
        type: "Feature" as const,
        properties: {
          id: v.id, name: v.name, shortName, color,
          cargo: v.cargo, cargoValue: v.cargoValue, insurancePremium: v.insurancePremium,
          departurePort: v.departurePort, arrivalPort: v.arrivalPort,
          typeLabel: vesselTypeLabel(v.type), pct, eta,
          briefStatus: brief.status, briefText: brief.brief, briefColor: brief.statusColor,
          chokeHit: choke.hit ? 1 : 0, chokeName: choke.name || "",
          label: shortName,
        },
        geometry: { type: "Point" as const, coordinates: [pos.lng, pos.lat] },
      }
    }).filter(Boolean) as GeoJSON.Feature[],
  }
}

const ALL_LAYERS = [
  "country-fill", "country-border",
  "routes-glow", "routes-line", "routes-dash",
  "facility-icons", "chokepoint-icons", "vessel-icons",
  "countries-labels", "night-fill", "night-edge",
]
const ALL_SOURCES = [
  "country-bounds", "routes", "countries",
  "facility-pts", "chokepoint-pts", "vessel-pts", "night-overlay",
]

interface GlobeMapProps {
  onMapReady?: (map: mapboxgl.Map) => void
}

export function GlobeMap({ onMapReady }: GlobeMapProps = {}) {
  const mapBox = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const countriesRef = useRef<MapCountry[]>([])
  const firstStyle = useRef(true)
  const routeSplines = useRef<Map<string, [number, number][]>>(new Map())
  const iconsLoaded = useRef(false)
  const { selectCountry, selectedCountryCode, isDemoMode } = useAppStore()
  const { theme } = useThemeStore()
  const [ready, setReady] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [layers, setLayers] = useState({
    routes: true, vessels: true, facilities: true, chokepoints: true, night: true, labels: true,
  })
  const { data: apiCountries } = useCountries()

  useEffect(() => { if (apiCountries) countriesRef.current = apiCountries }, [apiCountries])

  const fogFor = () => ({
    color: "rgb(20, 24, 45)",
    "high-color": "rgb(15, 18, 35)",
    "horizon-blend": 0.03,
    "space-color": "rgb(8, 10, 20)",
    "star-intensity": 0.8,
  })

  const buildNightGeoJSON = (): GeoJSON.FeatureCollection => {
    const now = new Date()
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
    const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))
    const declClamped = Math.abs(decl) < 0.1 ? (decl >= 0 ? 0.1 : -0.1) : decl
    const declRad = (declClamped * Math.PI) / 180
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
    const sunLng = ((12 - utcH) * 15 + 540) % 360 - 180
    const terminator: [number, number][] = []
    for (let lng = -180; lng <= 180; lng += 1) {
      const ha = ((lng - sunLng) * Math.PI) / 180
      const lat = (Math.atan(-Math.cos(ha) / Math.tan(declRad)) * 180) / Math.PI
      terminator.push([lng, lat])
    }
    const darkLat = declClamped >= 0 ? -90 : 90
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...terminator, [180, darkLat], [-180, darkLat], terminator[0]]] } }],
    }
  }

  const applyNightOverlay = (m: mapboxgl.Map) => {
    const data = buildNightGeoJSON()
    const src = m.getSource("night-overlay") as mapboxgl.GeoJSONSource | undefined
    if (src) { src.setData(data); return }
    m.addSource("night-overlay", { type: "geojson", data })
    m.addLayer({ id: "night-fill", type: "fill", source: "night-overlay", paint: { "fill-color": "rgba(2, 4, 20, 0.12)" } })
    m.addLayer({ id: "night-edge", type: "line", source: "night-overlay", paint: { "line-color": "rgba(20, 30, 80, 0.06)", "line-width": 40, "line-blur": 40 } })
  }

  const addAllLayers = useCallback((m: mapboxgl.Map) => {
    for (const id of ALL_LAYERS) { if (m.getLayer(id)) m.removeLayer(id) }
    for (const id of ALL_SOURCES) { if (m.getSource(id)) m.removeSource(id) }
    if (!iconsLoaded.current) { loadMarkerIcons(m); iconsLoaded.current = true }

    const cList = countriesRef.current

    // 1. Country choropleth
    m.addSource("country-bounds", { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" })
    m.addLayer({ id: "country-fill", type: "fill", source: "country-bounds", "source-layer": "country_boundaries",
      filter: ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]],
      paint: { "fill-color": buildFillColor(cList, RISK_FILL), "fill-opacity": 1 },
    })
    m.addLayer({ id: "country-border", type: "line", source: "country-bounds", "source-layer": "country_boundaries",
      filter: ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]],
      paint: { "line-color": buildFillColor(cList, RISK_BORDER), "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 1.5], "line-opacity": 1 },
    })
    m.on("click", "country-fill", (e) => { const code = e.features?.[0]?.properties?.iso_3166_1; if (code) selectCountry(code) })
    const cPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "sentinel-popup", maxWidth: "220px", offset: 14 })
    let hoveredCountryCode = ""
    const updateCountryPopup = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      m.getCanvas().style.cursor = "pointer"
      const code = e.features?.[0]?.properties?.iso_3166_1 ?? ""
      if (code && code !== hoveredCountryCode) {
        hoveredCountryCode = code
        const c = countriesRef.current.find(x => x.code === code)
        if (c) {
          const color = RISK[c.riskLevel] || "#64748b"
          cPopup.setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${c.name}</div><div class="sentinel-popup-row"><span class="sentinel-popup-val" style="color:${color}">${c.score}</span><span class="sentinel-popup-badge" style="color:${color}">${c.riskLevel}</span></div></div>`)
        }
      }
      cPopup.setLngLat(e.lngLat).addTo(m)
    }
    m.on("mouseenter", "country-fill", updateCountryPopup)
    m.on("mousemove", "country-fill", updateCountryPopup)
    m.on("mouseleave", "country-fill", () => { m.getCanvas().style.cursor = ""; hoveredCountryCode = ""; cPopup.remove() })

    // 2. Trade routes
    const routeFeatures = tradeRoutes.map((rt) => {
      const wp = WAYPOINTS[rt.id]
      const coords = wp ? catmullRom(wp) : catmullRom([[rt.from.lng, rt.from.lat], [rt.to.lng, rt.to.lat]])
      routeSplines.current.set(rt.id, coords)
      return { type: "Feature" as const, properties: { color: RISK[rt.riskLevel], risk: rt.riskLevel, cargo: rt.annualCargo, chokepoint: rt.chokepoint, label: `${rt.from.name} → ${rt.to.name}` }, geometry: { type: "LineString" as const, coordinates: coords } }
    })
    m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: routeFeatures } })
    m.addLayer({ id: "routes-glow", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get","color"], "line-width": 8, "line-opacity": 0.12, "line-blur": 6 } })
    m.addLayer({ id: "routes-line", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get","color"], "line-width": 2, "line-opacity": 0.65 } })
    m.addLayer({ id: "routes-dash", type: "line", source: "routes", filter: ["in", ["get","risk"], ["literal",["HIGH","CRITICAL"]]], layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.18, "line-dasharray": [2,6] } })
    const rPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "sentinel-popup", maxWidth: "260px", offset: 14 })
    m.on("mouseenter", "routes-line", (e) => {
      m.getCanvas().style.cursor = "pointer"
      const p = e.features?.[0]?.properties; if (!p) return
      const val = p.cargo >= 1000 ? `$${(p.cargo / 1000).toFixed(1)}B` : `$${p.cargo}M`
      rPopup.setLngLat(e.lngLat).setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${p.label}</div><div class="sentinel-popup-sub">${p.chokepoint}</div><div class="sentinel-popup-row"><span class="sentinel-popup-val" style="color:${p.color}">${val}/yr</span><span class="sentinel-popup-badge" style="color:${p.color}">${p.risk}</span></div></div>`).addTo(m)
    })
    m.on("mousemove", "routes-line", (e) => rPopup.setLngLat(e.lngLat))
    m.on("mouseleave", "routes-line", () => { m.getCanvas().style.cursor = ""; rPopup.remove() })

    // 3. Facility symbol layer (WebGL-native — zero lag)
    m.addSource("facility-pts", { type: "geojson", data: facilityGeoJSON() })
    m.addLayer({ id: "facility-icons", type: "symbol", source: "facility-pts",
      layout: { "icon-image": "mk-factory", "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.55, 5, 0.8], "icon-allow-overlap": true, "text-field": ["get", "label"], "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-size": 10, "text-offset": [0, 1.8], "text-anchor": "top", "text-allow-overlap": false, "text-optional": true, "text-letter-spacing": 0.05 },
      paint: { "icon-color": "#34d399", "icon-halo-color": "rgba(0,0,0,0.6)", "icon-halo-width": 3, "text-color": "#34d399", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.4 },
    })
    const fPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "sentinel-popup", maxWidth: "260px", offset: 18 })
    m.on("mouseenter", "facility-icons", (e) => {
      m.getCanvas().style.cursor = "pointer"
      const p = e.features?.[0]?.properties; if (!p) return
      const coords = (e.features![0].geometry as GeoJSON.Point).coordinates as [number, number]
      fPopup.setLngLat(coords).setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${p.name}</div><div class="sentinel-popup-sub">${p.location}</div><div class="sentinel-popup-sub" style="margin-bottom:6px">${p.function}</div><div class="sentinel-popup-val" style="color:${p.color};font-size:14px">${p.valStr}/yr</div></div>`).addTo(m)
    })
    m.on("mouseleave", "facility-icons", () => { m.getCanvas().style.cursor = ""; fPopup.remove() })

    // 4. Chokepoint symbol layer (WebGL-native — zero lag)
    m.addSource("chokepoint-pts", { type: "geojson", data: chokepointGeoJSON() })
    m.addLayer({ id: "chokepoint-icons", type: "symbol", source: "chokepoint-pts",
      layout: { "icon-image": "mk-warning", "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.45, 5, 0.7], "icon-allow-overlap": true, "text-field": ["get", "label"], "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-size": 9, "text-offset": [0, 1.6], "text-anchor": "top", "text-allow-overlap": false, "text-optional": true, "text-letter-spacing": 0.06 },
      paint: { "icon-color": "#fb923c", "icon-halo-color": "rgba(0,0,0,0.6)", "icon-halo-width": 3, "text-color": "#fb923c", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.4 },
    })

    // 5. Vessel symbol layer (WebGL-native — zero lag)
    m.addSource("vessel-pts", { type: "geojson", data: vesselGeoJSON(routeSplines.current) })
    m.addLayer({ id: "vessel-icons", type: "symbol", source: "vessel-pts",
      layout: { "icon-image": "mk-ship", "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.5, 5, 0.75], "icon-allow-overlap": true, "text-field": ["get", "label"], "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-size": 9, "text-offset": [0, 1.7], "text-anchor": "top", "text-allow-overlap": false, "text-optional": true, "text-letter-spacing": 0.04 },
      paint: { "icon-color": "#60a5fa", "icon-halo-color": "rgba(0,0,0,0.6)", "icon-halo-width": 3, "text-color": "#60a5fa", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.4 },
    })
    const vPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "sentinel-popup", maxWidth: "300px", offset: 18 })
    m.on("mouseenter", "vessel-icons", (e) => {
      m.getCanvas().style.cursor = "pointer"
      const p = e.features?.[0]?.properties; if (!p) return
      const coords = (e.features![0].geometry as GeoJSON.Point).coordinates as [number, number]
      const chokeHtml = p.chokeHit ? `<div class="sentinel-popup-row" style="margin-top:4px"><span class="sentinel-popup-badge" style="color:#ef4444">⚠ ${p.chokeName}</span></div>` : ""
      vPopup.setLngLat(coords).setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${p.name}</div><div class="sentinel-popup-sub">${p.typeLabel} · ${p.departurePort} → ${p.arrivalPort}</div><div style="margin-top:6px;padding:3px 6px;border-radius:3px;background:${p.briefColor}18;border:1px solid ${p.briefColor}30;display:inline-block"><span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:${p.briefColor};letter-spacing:0.05em">${p.briefStatus}</span></div><div style="margin-top:4px;font-size:10px;color:#94a3b8;line-height:1.4">${p.briefText}</div><div class="sentinel-popup-row" style="margin-top:6px"><span style="color:#94a3b8;font-size:10px">Cargo</span><span class="sentinel-popup-val" style="font-size:11px">${p.cargo}</span></div><div class="sentinel-popup-row"><span style="color:#94a3b8;font-size:10px">Value</span><span class="sentinel-popup-val" style="color:#60a5fa">$${p.cargoValue}M</span></div><div class="sentinel-popup-row"><span style="color:#94a3b8;font-size:10px">Insurance</span><span class="sentinel-popup-val" style="color:#fbbf24">$${p.insurancePremium}M</span></div><div class="sentinel-popup-row"><span style="color:#94a3b8;font-size:10px">ETA</span><span class="sentinel-popup-val">${p.eta}</span></div><div style="margin-top:6px;height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden"><div style="width:${p.pct}%;height:100%;border-radius:2px;background:${p.color}"></div></div><div style="text-align:right;font-size:9px;color:#64748b;margin-top:2px">${p.pct}% complete</div>${chokeHtml}</div>`).addTo(m)
    })
    m.on("mouseleave", "vessel-icons", () => { m.getCanvas().style.cursor = ""; vPopup.remove() })

    // 6. Country labels
    m.addSource("countries", { type: "geojson", data: cList.length ? countryGeoJSON(cList) : { type: "FeatureCollection", features: [] } })
    m.addLayer({ id: "countries-labels", type: "symbol", source: "countries",
      filter: ["<=", ["get", "priority"], 2],
      layout: { "text-field": ["get", "label"], "text-size": ["match", ["get", "riskLevel"], "CRITICAL", 12, "HIGH", 11, 10], "text-offset": [0, 0], "text-anchor": "center", "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": false, "text-optional": true, "text-padding": 4, "symbol-sort-key": ["get", "priority"], "text-letter-spacing": 0.05 },
      paint: { "text-color": ["get", "color"], "text-halo-color": "rgba(0,0,0,0.85)", "text-halo-width": 1.5, "text-halo-blur": 0.5 },
    })

    applyNightOverlay(m)
  }, [selectCountry])

  useEffect(() => {
    if (!mapBox.current) return
    if (map.current) { map.current.remove(); map.current = null }
    if (!TOKEN) return
    mapboxgl.accessToken = TOKEN
    let cancelled = false
    let m: mapboxgl.Map
    try {
      m = new mapboxgl.Map({
        container: mapBox.current, style: "mapbox://styles/mapbox/dark-v11",
        center: [55, 20], zoom: 1.8, projection: "globe",
        attributionControl: false, logoPosition: "bottom-left", maxZoom: 8, minZoom: 0.8,
        renderWorldCopies: false,
      })
    } catch (e) {
      console.error("[GlobeMap] Failed to create map:", e)
      return
    }
    m.on("error", (e) => {
      console.error("[GlobeMap] Map error:", e.error?.message || e)
    })
    m.on("style.load", () => {
      if (cancelled) return
      m.setFog(fogFor())
      setReady(true)
      onMapReady?.(m)
    })
    // Smooth auto-rotate: gentle continuous drift, user interaction pauses it.
    let spinning = false
    const spin = () => {
      if (!spinning) return
      const c = m.getCenter()
      m.easeTo({ center: [c.lng + 60, c.lat], duration: 60000, easing: (t: number) => t })
    }
    const startSpin = () => { spinning = true; spin() }
    const stopSpin = () => { spinning = false; m.stop() }
    m.on("moveend", () => { if (spinning) spin() })
    m.on("mousedown", stopSpin)
    m.on("touchstart", stopSpin)
    m.on("wheel", stopSpin)
    ;(m as any)._startSpin = startSpin
    ;(m as any)._stopSpin = stopSpin
    m.once("idle", () => { if (!cancelled) startSpin() })
    map.current = m
    useAppStore.getState().setMapInstance(m)
    return () => { cancelled = true; m.stop(); m.remove(); map.current = null; useAppStore.getState().setMapInstance(null) }
  }, [])

  useEffect(() => {
    const m = map.current; if (!m) return
    if (firstStyle.current) { firstStyle.current = false; return }
    if (m.isStyleLoaded()) m.setFog(fogFor())
  }, [theme])

  useEffect(() => {
    if (!ready || !map.current) return
    try {
      addAllLayers(map.current)
    } catch (e) {
      console.error("[GlobeMap] addAllLayers crashed:", e)
    }
  }, [ready, addAllLayers])

  useEffect(() => {
    if (!ready || !map.current) return
    const interval = setInterval(() => { if (map.current) applyNightOverlay(map.current) }, 60_000)
    return () => clearInterval(interval)
  }, [ready])

  // Resize map only when container dimensions actually change (window resize).
  // Tracks previous size to skip no-op resizes that cause flashes.
  useEffect(() => {
    const el = mapBox.current
    if (!el) return
    let prevW = el.clientWidth
    let prevH = el.clientHeight
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w === prevW && h === prevH) return
      prevW = w
      prevH = h
      map.current?.resize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!ready || !map.current || !apiCountries?.length) return
    const m = map.current
    if (m.getLayer("country-fill")) m.setPaintProperty("country-fill", "fill-color", buildFillColor(apiCountries, RISK_FILL))
    if (m.getLayer("country-border")) m.setPaintProperty("country-border", "line-color", buildFillColor(apiCountries, RISK_BORDER))
    const src = m.getSource("countries") as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(countryGeoJSON(apiCountries))
  }, [ready, apiCountries])

  useEffect(() => {
    const m = map.current; if (!m || !ready) return
    if (!selectedCountryCode) {
      // Smoothly return to overview and resume spin
      m.flyTo({ center: [55, 20], zoom: 1.8, pitch: 0, bearing: 0, duration: 1800, essential: true })
      m.once("moveend", () => { ;(m as any)._startSpin?.() })
      return
    }
    ;(m as any)._stopSpin?.()
    const coords = resolveCoords(selectedCountryCode, apiCountries)
    if (!coords) return
    const zoom = zoomForCountry(selectedCountryCode)
    if (isDemoMode) {
      m.flyTo({ center: coords, zoom, pitch: 45, bearing: -20, duration: 2000, essential: true })
    } else {
      m.flyTo({ center: coords, zoom, pitch: 0, bearing: 0, duration: 1500, essential: true })
    }
  }, [selectedCountryCode, apiCountries, isDemoMode, ready])

  // Layer visibility toggle
  useEffect(() => {
    const m = map.current; if (!m || !ready) return
    const vis = (on: boolean) => on ? "visible" as const : "none" as const
    const layerMap: Record<string, string[]> = {
      routes: ["routes-glow", "routes-line", "routes-dash"],
      vessels: ["vessel-icons"],
      facilities: ["facility-icons"],
      chokepoints: ["chokepoint-icons"],
      night: ["night-fill", "night-edge"],
      labels: ["countries-labels"],
    }
    for (const [key, ids] of Object.entries(layerMap)) {
      const v = vis(layers[key as keyof typeof layers])
      for (const id of ids) { if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v) }
    }
  }, [layers, ready])


  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#020206" }}>
      <div ref={mapBox} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* LIVE bar + expandable key/filter panel */}
      <div className="absolute top-3 left-3 flex flex-col" style={{ zIndex: 10 }}>
        {/* LIVE pill */}
        <div className="pointer-events-none flex h-8 items-center gap-2.5 rounded-full backdrop-blur-md px-4"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            border: "1px solid var(--sentinel-border)",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-data text-[11px] font-bold tracking-widest"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            LIVE
          </span>
          <span className="h-3 w-px" style={{ backgroundColor: "var(--sentinel-border)" }} />
          <span className="font-data text-[11px] tracking-wide"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {apiCountries?.length ?? 0} Nations · {facilities.length} Facilities · {tradeRoutes.length} Routes · {VESSELS.length} Vessels · {CHOKEPOINTS.length} Chokepoints
          </span>
        </div>

        {/* Key + Filter toggle */}
        <button
          onClick={() => setKeyOpen((p) => !p)}
          className="pointer-events-auto mt-1.5 flex h-7 items-center gap-2 self-start rounded-full backdrop-blur-md px-3 cursor-pointer transition-colors"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            border: "1px solid var(--sentinel-border)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--sentinel-accent)" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--sentinel-border)" }}
        >
          <span className="font-data text-[10px] font-semibold tracking-widest"
            style={{ color: "var(--sentinel-text-secondary)" }}
          >
            KEY & LAYERS
          </span>
          <ChevronDown size={12}
            className={`transition-transform duration-200`}
            style={{ color: "var(--sentinel-text-tertiary)", transform: keyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {/* Expandable panel */}
        {keyOpen && (
          <div
            className="pointer-events-auto mt-1 flex flex-col gap-2 rounded-xl backdrop-blur-md px-3 py-2.5 w-48"
            style={{
              backgroundColor: "var(--sentinel-bg-elevated)",
              border: "1px solid var(--sentinel-border)",
            }}
          >
            {/* Risk levels — vertical list */}
            <div>
              <span className="font-data text-[10px] font-bold tracking-widest"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                RISK LEVELS
              </span>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {(["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((level) => (
                  <div key={level} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: RISK[level], opacity: 0.85 }} />
                    <span className="font-data text-[10px] font-medium tracking-wider"
                      style={{ color: "var(--sentinel-text-tertiary)" }}
                    >{level}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />

            {/* Layers — toggleable, doubles as entity key */}
            <div>
              <span className="font-data text-[10px] font-bold tracking-widest"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                LAYERS
              </span>
              <div className="mt-1 flex flex-col gap-0">
                {([
                  { key: "routes" as const, label: "Routes", icon: <span className="inline-block h-[2px] w-3.5 rounded-full bg-amber-400" /> },
                  { key: "vessels" as const, label: "Vessels", icon: <Ship size={13} className="text-sky-400" /> },
                  { key: "facilities" as const, label: "Facilities", icon: <Factory size={13} className="text-emerald-400" /> },
                  { key: "chokepoints" as const, label: "Chokepoints", icon: <AlertTriangle size={13} className="text-orange-400" /> },
                  { key: "night" as const, label: "Night", icon: <span className="inline-block h-3 w-3 rounded-full bg-indigo-500/50" /> },
                  { key: "labels" as const, label: "Labels", icon: <span className="font-data text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>A</span> },
                ]).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors cursor-pointer"
                    style={{ backgroundColor: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-overlay)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
                  >
                    <span className="w-4 flex justify-center shrink-0">{icon}</span>
                    <span className="flex-1 text-left font-data text-[11px] tracking-wide"
                      style={{ color: "var(--sentinel-text-secondary)" }}
                    >{label}</span>
                    {layers[key]
                      ? <Eye size={12} style={{ color: "var(--risk-low)", opacity: 0.7 }} />
                      : <EyeOff size={12} style={{ color: "var(--sentinel-text-tertiary)", opacity: 0.4 }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

