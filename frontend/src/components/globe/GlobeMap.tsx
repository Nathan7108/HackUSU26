import { useRef, useEffect, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import { useAppStore } from "@/stores/app"
import { useThemeStore } from "@/stores/theme"
import { facilities, tradeRoutes } from "@/data"
import { useCountries, type MapCountry } from "@/hooks/useCountries"
import { COUNTRY_COORDS } from "@/data/countryCoords"

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

/* ─── Colors ─────────────────────────────────────────────────── */
const RISK: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  ELEVATED: "#eab308",
  MODERATE: "#3b82f6",
  LOW: "#22c55e",
}

const FAC_COLOR: Record<string, string> = {
  hq: "#60a5fa",
  manufacturing: "#34d399",
  processing: "#fbbf24",
  assembly: "#a78bfa",
  distribution: "#94a3b8",
}

const RISK_PRIORITY: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, ELEVATED: 2, MODERATE: 3, LOW: 4,
}

/* ─── Shipping-lane waypoints [lng, lat] ─────────────────────── */
const WAYPOINTS: Record<string, [number, number][]> = {
  r1: [
    [109.84, 40.66], [113.5, 38.0], [117.7, 39.0],
    [121.5, 31.2], [120.97, 24.8],
  ],
  r2: [
    [120.97, 24.8], [123.0, 26.0], [127.5, 28.5],
    [131.0, 31.5], [136.91, 35.18],
  ],
  r3: [
    [136.91, 35.18], [133.0, 31.0], [128.0, 26.0],
    [122.0, 18.0], [115.0, 10.0], [108.0, 5.0],
    [103.82, 1.35],
  ],
  r4: [
    [103.82, 1.35], [100.5, 2.5], [95.0, 5.5],
    [80.0, 7.0], [72.0, 10.0], [60.0, 14.0],
    [50.0, 12.5], [43.5, 12.6], [38.5, 18.0],
    [34.0, 25.0], [32.5, 30.5], [30.0, 33.0],
    [25.0, 35.0], [15.0, 37.5], [5.0, 37.5],
    [-5.5, 36.0], [-9.0, 39.5], [-4.0, 46.0],
    [1.0, 50.0], [4.48, 51.92],
  ],
  r5: [
    [4.48, 51.92], [3.0, 49.0], [2.3, 47.0], [1.44, 43.6],
  ],
  r6: [
    [4.48, 51.92], [-2.0, 49.5], [-8.0, 47.0],
    [-20.0, 42.0], [-40.0, 35.0], [-60.0, 28.0],
    [-72.0, 22.0], [-79.0, 14.0], [-79.5, 9.0],
    [-85.0, 9.0], [-95.0, 14.0], [-105.0, 20.0],
    [-118.0, 32.0], [-124.0, 40.0], [-122.68, 45.52],
  ],
  r7: [
    [10.99, 45.44], [7.0, 45.0], [4.0, 44.5], [1.44, 43.6],
  ],
  r8: [
    [109.84, 40.66], [117.7, 39.0], [125.0, 37.0],
    [135.0, 36.0], [145.0, 40.0], [160.0, 44.0],
    [175.0, 47.0], [190.0, 48.0], [210.0, 48.0],
    [225.0, 47.0], [235.0, 45.5], [237.32, 45.52],
  ],
  r9: [
    [1.44, 43.6], [-2.0, 44.0], [-10.0, 42.0],
    [-30.0, 37.0], [-50.0, 30.0], [-65.0, 24.0],
    [-76.0, 18.0], [-79.5, 9.0], [-85.0, 9.0],
    [-95.0, 14.0], [-105.0, 20.0], [-118.0, 32.0],
    [-124.0, 40.0], [-122.68, 45.52],
  ],
}

/* ─── Chokepoints ────────────────────────────────────────────── */
const CHOKEPOINTS = [
  { name: "TAIWAN STRAIT", lat: 24.5, lng: 119.5, risk: "HIGH" },
  { name: "MALACCA STRAIT", lat: 2.5, lng: 101.0, risk: "HIGH" },
  { name: "BAB EL-MANDEB", lat: 12.6, lng: 43.3, risk: "CRITICAL" },
  { name: "SUEZ CANAL", lat: 30.5, lng: 32.3, risk: "ELEVATED" },
  { name: "STRAIT OF HORMUZ", lat: 26.5, lng: 56.3, risk: "CRITICAL" },
  { name: "SOUTH CHINA SEA", lat: 14.5, lng: 115.0, risk: "ELEVATED" },
]

/* ─── Catmull-Rom spline — buttery smooth curves ─────────────── */
function catmullRom(pts: [number, number][], segments = 24): [number, number][] {
  if (pts.length < 2) return pts
  const out: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let j = 0; j < segments; j++) {
      const t = j / segments
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/* ─── Build country GeoJSON ──────────────────────────────────── */
function countryGeoJSON(list: MapCountry[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list.map((c) => ({
      type: "Feature" as const,
      properties: {
        code: c.code,
        name: c.name,
        score: c.score,
        riskLevel: c.riskLevel,
        color: RISK[c.riskLevel] || "#64748b",
        radius: c.riskLevel === "CRITICAL" ? 10
          : c.riskLevel === "HIGH" ? 7
          : c.riskLevel === "ELEVATED" ? 5
          : c.riskLevel === "MODERATE" ? 3.5
          : 2.5,
        priority: RISK_PRIORITY[c.riskLevel] ?? 4,
        label: `${c.code} ${c.score}`,
      },
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    })),
  }
}

/* ─── IDs ────────────────────────────────────────────────────── */
const ROUTE_IDS = ["routes-glow", "routes-line", "routes-dash"]
const COUNTRY_IDS = ["countries-glow", "countries-circle", "countries-labels"]

/* ════════════════════════════════════════════════════════════════
   GlobeMap
   ════════════════════════════════════════════════════════════════ */
export function GlobeMap() {
  const mapBox = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const htmlMarkers = useRef<mapboxgl.Marker[]>([])
  const countriesRef = useRef<MapCountry[]>([])
  const firstStyle = useRef(true)
  const { selectCountry, selectedCountryCode } = useAppStore()
  const { theme } = useThemeStore()
  const [ready, setReady] = useState(false)
  const { data: apiCountries } = useCountries()

  // Keep ref in sync so theme effect can access latest data without being a dependency
  useEffect(() => {
    if (apiCountries) countriesRef.current = apiCountries
  }, [apiCountries])

  /* ── Fog ───────────────────────────────────────────────────── */
  const fogFor = (t: string) => ({
    color: t === "dark" ? "rgb(15, 20, 25)" : "rgb(220, 230, 240)",
    "high-color": t === "dark" ? "rgb(20, 30, 50)" : "rgb(180, 200, 230)",
    "horizon-blend": 0.04,
    "space-color": t === "dark" ? "rgb(10, 14, 18)" : "rgb(200, 210, 225)",
    "star-intensity": t === "dark" ? 0.8 : 0,
  })

  /* ── Add all map layers ────────────────────────────────────── */
  const addAllLayers = useCallback((m: mapboxgl.Map) => {
    // Tear down HTML markers
    htmlMarkers.current.forEach((mk) => mk.remove())
    htmlMarkers.current = []

    // Tear down old Mapbox layers/sources
    for (const id of [...ROUTE_IDS, ...COUNTRY_IDS]) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    if (m.getSource("routes")) m.removeSource("routes")
    if (m.getSource("countries")) m.removeSource("countries")

    /* ── 1. Trade routes ─────────────────────────────────────── */
    const routeFeatures = tradeRoutes.map((r) => {
      const wp = WAYPOINTS[r.id]
      const coords = wp ? catmullRom(wp) : catmullRom([
        [r.from.lng, r.from.lat],
        [r.to.lng, r.to.lat],
      ])
      return {
        type: "Feature" as const,
        properties: {
          color: RISK[r.riskLevel],
          risk: r.riskLevel,
          width: Math.max(1.5, Math.min(4, r.annualCargo / 300)),
          cargo: r.annualCargo,
          chokepoint: r.chokepoint,
          label: `${r.from.name} → ${r.to.name}`,
        },
        geometry: { type: "LineString" as const, coordinates: coords },
      }
    })

    m.addSource("routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: routeFeatures },
    })

    m.addLayer({
      id: "routes-glow",
      type: "line",
      source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["*", ["get", "width"], 4],
        "line-opacity": 0.12,
        "line-blur": 6,
      },
    })

    m.addLayer({
      id: "routes-line",
      type: "line",
      source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["get", "width"],
        "line-opacity": 0.65,
      },
    })

    m.addLayer({
      id: "routes-dash",
      type: "line",
      source: "routes",
      filter: ["in", ["get", "risk"], ["literal", ["HIGH", "CRITICAL"]]],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 1,
        "line-opacity": 0.18,
        "line-dasharray": [2, 6],
      },
    })

    // Route hover
    const routePopup = new mapboxgl.Popup({
      closeButton: false, closeOnClick: false,
      className: "sentinel-popup", maxWidth: "260px", offset: 14,
    })
    m.on("mouseenter", "routes-line", (e) => {
      m.getCanvas().style.cursor = "pointer"
      const p = e.features?.[0]?.properties
      if (!p) return
      const val = p.cargo >= 1000 ? `$${(p.cargo / 1000).toFixed(1)}B` : `$${p.cargo}M`
      routePopup.setLngLat(e.lngLat).setHTML(`
        <div class="sentinel-popup-inner">
          <div class="sentinel-popup-title">${p.label}</div>
          <div class="sentinel-popup-sub">${p.chokepoint}</div>
          <div class="sentinel-popup-row">
            <span class="sentinel-popup-val" style="color:${p.color}">${val}/yr</span>
            <span class="sentinel-popup-badge" style="color:${p.color}">${p.risk}</span>
          </div>
        </div>
      `).addTo(m)
    })
    m.on("mousemove", "routes-line", (e) => routePopup.setLngLat(e.lngLat))
    m.on("mouseleave", "routes-line", () => {
      m.getCanvas().style.cursor = ""
      routePopup.remove()
    })

    /* ── 2. Countries (native GeoJSON layers) ────────────────── */
    const cList = countriesRef.current
    m.addSource("countries", {
      type: "geojson",
      data: cList.length ? countryGeoJSON(cList) : { type: "FeatureCollection", features: [] },
    })

    // Glow for CRITICAL + HIGH
    m.addLayer({
      id: "countries-glow",
      type: "circle",
      source: "countries",
      filter: ["<=", ["get", "priority"], 1],
      paint: {
        "circle-radius": ["*", ["get", "radius"], 2.8],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.12,
        "circle-blur": 0.8,
      },
    })

    // Main circles
    m.addLayer({
      id: "countries-circle",
      type: "circle",
      source: "countries",
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          1, ["get", "radius"],
          5, ["*", ["get", "radius"], 1.8],
        ],
        "circle-color": ["get", "color"],
        "circle-opacity": [
          "match", ["get", "riskLevel"],
          "CRITICAL", 0.9, "HIGH", 0.85, "ELEVATED", 0.7, "MODERATE", 0.5, 0.35,
        ],
        "circle-stroke-width": [
          "match", ["get", "riskLevel"],
          "CRITICAL", 2, "HIGH", 1.5, 1,
        ],
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-opacity": 0.4,
      },
    })

    // Labels — Mapbox collision detection handles overlap
    m.addLayer({
      id: "countries-labels",
      type: "symbol",
      source: "countries",
      filter: ["<=", ["get", "priority"], 2],
      layout: {
        "text-field": ["get", "label"],
        "text-size": ["match", ["get", "riskLevel"], "CRITICAL", 12, "HIGH", 11, 10],
        "text-offset": [0, 1.4],
        "text-anchor": "top",
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-allow-overlap": false,
        "text-optional": true,
        "text-padding": 4,
        "symbol-sort-key": ["get", "priority"],
        "text-letter-spacing": 0.05,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": "rgba(0,0,0,0.85)",
        "text-halo-width": 1.5,
        "text-halo-blur": 0.5,
      },
    })

    // Country click + hover
    m.on("click", "countries-circle", (e) => {
      const code = e.features?.[0]?.properties?.code
      if (code) selectCountry(code)
    })
    const countryPopup = new mapboxgl.Popup({
      closeButton: false, closeOnClick: false,
      className: "sentinel-popup", maxWidth: "220px", offset: 14,
    })
    m.on("mouseenter", "countries-circle", (e) => {
      m.getCanvas().style.cursor = "pointer"
      const p = e.features?.[0]?.properties
      if (!p) return
      countryPopup.setLngLat(e.lngLat).setHTML(`
        <div class="sentinel-popup-inner">
          <div class="sentinel-popup-title">${p.name}</div>
          <div class="sentinel-popup-row">
            <span class="sentinel-popup-val" style="color:${p.color}">${p.score}</span>
            <span class="sentinel-popup-badge" style="color:${p.color}">${p.riskLevel}</span>
          </div>
        </div>
      `).addTo(m)
    })
    m.on("mousemove", "countries-circle", (e) => countryPopup.setLngLat(e.lngLat))
    m.on("mouseleave", "countries-circle", () => {
      m.getCanvas().style.cursor = ""
      countryPopup.remove()
    })

    /* ── 3. Chokepoints (HTML — only 6) ──────────────────────── */
    CHOKEPOINTS.forEach((cp) => {
      const c = RISK[cp.risk] || "#f97316"
      const el = document.createElement("div")
      el.className = "sentinel-chokepoint"
      el.innerHTML = `
        <div style="width:10px;height:10px;background:${c};transform:rotate(45deg);
          box-shadow:0 0 8px ${c}80,0 0 20px ${c}30;border:1px solid ${c};"></div>
        <div style="margin-top:5px;font-family:'JetBrains Mono',monospace;font-size:8px;
          font-weight:700;color:${c};white-space:nowrap;letter-spacing:1px;
          text-shadow:0 1px 4px rgba(0,0,0,1),0 0 12px rgba(0,0,0,0.8);">${cp.name}</div>
      `
      htmlMarkers.current.push(
        new mapboxgl.Marker({ element: el }).setLngLat([cp.lng, cp.lat]).addTo(m),
      )
    })

    /* ── 4. Facilities (HTML — only 8) ───────────────────────── */
    facilities.forEach((f) => {
      const c = FAC_COLOR[f.type]
      const sz = f.annualValue >= 400 ? 16 : f.annualValue > 0 ? 12 : 10
      const el = document.createElement("div")
      el.className = "sentinel-facility"
      el.style.cssText = `width:${sz}px;height:${sz}px;cursor:pointer;transform:rotate(45deg);
        background:${c}25;border:2px solid ${c};border-radius:2px;
        box-shadow:0 0 10px ${c}50,0 0 20px ${c}20;transition:transform 0.15s,box-shadow 0.15s;`
      el.addEventListener("mouseenter", () => {
        el.style.transform = "rotate(45deg) scale(1.3)"
        el.style.boxShadow = `0 0 14px ${c}80,0 0 28px ${c}40`
      })
      el.addEventListener("mouseleave", () => {
        el.style.transform = "rotate(45deg) scale(1)"
        el.style.boxShadow = `0 0 10px ${c}50,0 0 20px ${c}20`
      })
      const valStr = f.annualValue >= 1000
        ? `$${(f.annualValue / 1000).toFixed(1)}B/yr`
        : f.annualValue > 0 ? `$${f.annualValue}M/yr` : "Distribution Hub"
      const popup = new mapboxgl.Popup({
        offset: 14, closeButton: false, className: "sentinel-popup", maxWidth: "240px",
      }).setHTML(`
        <div class="sentinel-popup-inner">
          <div class="sentinel-popup-title">${f.name}</div>
          <div class="sentinel-popup-sub">${f.location}</div>
          <div class="sentinel-popup-sub" style="margin-bottom:6px">${f.function}</div>
          <div class="sentinel-popup-val" style="color:${c};font-size:13px">${valStr}</div>
        </div>
      `)
      htmlMarkers.current.push(
        new mapboxgl.Marker({ element: el }).setLngLat([f.lng, f.lat]).setPopup(popup).addTo(m),
      )
    })
  }, [selectCountry])

  /* ── Init map ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapBox.current || map.current) return
    mapboxgl.accessToken = TOKEN

    const m = new mapboxgl.Map({
      container: mapBox.current,
      style: theme === "dark"
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11",
      center: [55, 20],
      zoom: 1.8,
      projection: "globe",
      attributionControl: false,
      logoPosition: "bottom-left",
      maxZoom: 8,
      minZoom: 1.2,
    })

    m.on("style.load", () => {
      m.setFog(fogFor(theme))
      setReady(true)
    })

    map.current = m
    return () => {
      htmlMarkers.current.forEach((mk) => mk.remove())
      m.remove()
      map.current = null
    }
  }, [])

  /* ── Theme switch (only fires on actual theme change) ──────── */
  useEffect(() => {
    const m = map.current
    if (!m) return
    // Skip the first render — init effect already set the style
    if (firstStyle.current) {
      firstStyle.current = false
      return
    }
    setReady(false)
    m.setStyle(
      theme === "dark"
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11",
    )
    m.once("style.load", () => {
      m.setFog(fogFor(theme))
      setReady(true) // triggers the ready effect below
    })
  }, [theme])

  /* ── Once ready → add all layers ───────────────────────────── */
  useEffect(() => {
    if (!ready || !map.current) return
    addAllLayers(map.current)
  }, [ready, addAllLayers])

  /* ── When API data arrives → update GeoJSON source ─────────── */
  useEffect(() => {
    if (!ready || !map.current || !apiCountries?.length) return
    const src = map.current.getSource("countries") as mapboxgl.GeoJSONSource | undefined
    if (src) {
      src.setData(countryGeoJSON(apiCountries))
    }
  }, [ready, apiCountries])

  /* ── Fly to selection ──────────────────────────────────────── */
  useEffect(() => {
    const m = map.current
    if (!m || !selectedCountryCode) return
    const found = apiCountries?.find((c) => c.code === selectedCountryCode)
    if (found) {
      m.flyTo({ center: [found.lng, found.lat], zoom: 4.5, duration: 1500, essential: true })
    } else {
      const coords = COUNTRY_COORDS[selectedCountryCode]
      if (coords) {
        m.flyTo({ center: [coords[1], coords[0]], zoom: 4.5, duration: 1500, essential: true })
      }
    }
  }, [selectedCountryCode, apiCountries])

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="relative h-full w-full">
      <div ref={mapBox} className="h-full w-full" />

      {/* Status badge */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1.5 backdrop-blur-sm border border-white/[0.06]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-data text-[9px] font-semibold tracking-widest text-white/60">
          LIVE — {apiCountries?.length ?? 0} NATIONS · {facilities.length} FACILITIES · {tradeRoutes.length} ROUTES
        </span>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-md bg-black/70 px-3 py-2 backdrop-blur-sm border border-white/[0.06]">
        <div className="flex items-center gap-3">
          {(["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK[level] }} />
              <span className="font-data text-[8px] font-medium tracking-wider text-white/50">
                {level}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LegendItem icon={<span className="h-2.5 w-2.5 rounded-full border border-white/40" style={{ background: "radial-gradient(circle,#94a3b8,#94a3b860)" }} />} label="NATION" />
          <LegendItem icon={<span className="inline-block h-2 w-2 rotate-45 border-[1.5px] border-[#60a5fa]" style={{ background: "#60a5fa25" }} />} label="FACILITY" />
          <LegendItem icon={<span className="inline-block h-2 w-2 rotate-45" style={{ background: "#f97316", boxShadow: "0 0 4px #f9731680" }} />} label="CHOKEPOINT" />
          <LegendItem icon={<span className="inline-block h-[2px] w-3 rounded-full bg-amber-400" />} label="ROUTE" />
        </div>
      </div>
    </div>
  )
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className="font-data text-[8px] tracking-wider text-white/50">{label}</span>
    </div>
  )
}
