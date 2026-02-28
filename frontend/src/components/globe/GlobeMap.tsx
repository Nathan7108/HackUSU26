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
  CRITICAL: "#ef4444", HIGH: "#f97316", ELEVATED: "#eab308",
  MODERATE: "#3b82f6", LOW: "#22c55e",
}
const RISK_FILL: Record<string, string> = {
  CRITICAL: "rgba(239, 68, 68, 0.35)",
  HIGH:     "rgba(249, 115, 22, 0.25)",
  ELEVATED: "rgba(234, 179, 8, 0.15)",
  MODERATE: "rgba(59, 130, 246, 0.08)",
  LOW:      "rgba(34, 197, 94, 0.05)",
}
const RISK_BORDER: Record<string, string> = {
  CRITICAL: "rgba(239, 68, 68, 0.6)",
  HIGH:     "rgba(249, 115, 22, 0.45)",
  ELEVATED: "rgba(234, 179, 8, 0.25)",
  MODERATE: "rgba(59, 130, 246, 0.12)",
  LOW:      "rgba(34, 197, 94, 0.06)",
}
const FAC_COLOR: Record<string, string> = {
  hq: "#60a5fa", manufacturing: "#34d399", processing: "#fbbf24",
  assembly: "#a78bfa", distribution: "#94a3b8",
}
const RISK_PRIORITY: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, ELEVATED: 2, MODERATE: 3, LOW: 4,
}

/* ─── Shipping-lane waypoints [lng, lat] ─────────────────────── */
const WAYPOINTS: Record<string, [number, number][]> = {
  r1: [[109.84,40.66],[113.5,38],[117.7,39],[121.5,31.2],[120.97,24.8]],
  r2: [[120.97,24.8],[123,26],[127.5,28.5],[131,31.5],[136.91,35.18]],
  r3: [[136.91,35.18],[133,31],[128,26],[122,18],[115,10],[108,5],[103.82,1.35]],
  r4: [[103.82,1.35],[100.5,2.5],[95,5.5],[80,7],[72,10],[60,14],[50,12.5],[43.5,12.6],[38.5,18],[34,25],[32.5,30.5],[30,33],[25,35],[15,37.5],[5,37.5],[-5.5,36],[-9,39.5],[-4,46],[1,50],[4.48,51.92]],
  r5: [[4.48,51.92],[3,49],[2.3,47],[1.44,43.6]],
  r6: [[4.48,51.92],[-2,49.5],[-8,47],[-20,42],[-40,35],[-60,28],[-72,22],[-79,14],[-79.5,9],[-85,9],[-95,14],[-105,20],[-118,32],[-124,40],[-122.68,45.52]],
  r7: [[10.99,45.44],[7,45],[4,44.5],[1.44,43.6]],
  r8: [[109.84,40.66],[117.7,39],[125,37],[135,36],[145,40],[160,44],[175,47],[190,48],[210,48],[225,47],[235,45.5],[237.32,45.52]],
  r9: [[1.44,43.6],[-2,44],[-10,42],[-30,37],[-50,30],[-65,24],[-76,18],[-79.5,9],[-85,9],[-95,14],[-105,20],[-118,32],[-124,40],[-122.68,45.52]],
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

/* ─── Catmull-Rom spline ─────────────────────────────────────── */
function catmullRom(pts: [number, number][], seg = 24): [number, number][] {
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

/* ─── Country GeoJSON (point source for labels) ──────────────── */
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

/* ─── Choropleth match expression builder ────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFillColor(countries: MapCountry[], colorMap: Record<string, string>): any {
  if (!countries.length) return "rgba(0,0,0,0)"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expr: any[] = ["match", ["get", "iso_3166_1"]]
  for (const c of countries) {
    const color = colorMap[c.riskLevel]
    if (color) expr.push(c.code, color)
  }
  expr.push("rgba(0,0,0,0)")
  return expr
}

/* ─── SDF icon SVGs ──────────────────────────────────────────── */
const ICON_SVGS: Record<string, string> = {
  "fac-hq": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="white" d="M14 44V12l10-6 10 6v32H14zM24 4l-2 2h4l-2-2z"/></svg>`,
  "fac-manufacturing": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="white" d="M4 44V24h6V6h5v18l8-7v7l8-7v7h9v20H4z"/></svg>`,
  "fac-processing": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="white" d="M17 4h14v4h-4v10l9 17a3 3 0 01-3 5H15a3 3 0 01-3-5l9-17V8h-4V4z"/></svg>`,
  "fac-assembly": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="white" d="M20 4h8v7l5.4 3.1a14 14 0 11-18.8 0L20 11V4zM24 19a7 7 0 100 14 7 7 0 000-14z" fill-rule="evenodd"/></svg>`,
  "fac-distribution": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="white" d="M4 18l20-12 20 12v26H4V18z"/></svg>`,
  "chokepoint": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="white" d="M24 4L6 40h36L24 4z"/></svg>`,
}

function loadSdfIcons(m: mapboxgl.Map): Promise<void> {
  const size = 48
  const entries = Object.entries(ICON_SVGS)
  return Promise.all(entries.map(([name, svg]) =>
    new Promise<void>((resolve) => {
      if (m.hasImage(name)) { resolve(); return }
      const img = new Image(size, size)
      img.onload = () => { m.addImage(name, img, { sdf: true }); resolve() }
      img.onerror = () => resolve()
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    })
  )).then(() => {})
}

/* ─── Layer / source IDs ─────────────────────────────────────── */
const ALL_LAYERS = [
  "country-fill", "country-border",
  "routes-glow", "routes-line", "routes-dash",
  "countries-labels",
  "facilities-bg", "facilities-icon", "facilities-labels",
  "chokepoints-icon", "chokepoints-labels",
]
const ALL_SOURCES = ["country-bounds", "routes", "countries", "facilities", "chokepoints"]

/* ════════════════════════════════════════════════════════════════
   GlobeMap
   ════════════════════════════════════════════════════════════════ */
export function GlobeMap() {
  const mapBox = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const countriesRef = useRef<MapCountry[]>([])
  const firstStyle = useRef(true)
  const { selectCountry, selectedCountryCode } = useAppStore()
  const { theme } = useThemeStore()
  const [ready, setReady] = useState(false)
  const { data: apiCountries } = useCountries()

  useEffect(() => { if (apiCountries) countriesRef.current = apiCountries }, [apiCountries])

  const fogFor = (t: string) => ({
    color: t === "dark" ? "rgb(15, 20, 25)" : "rgb(220, 230, 240)",
    "high-color": t === "dark" ? "rgb(20, 30, 50)" : "rgb(180, 200, 230)",
    "horizon-blend": 0.04,
    "space-color": t === "dark" ? "rgb(10, 14, 18)" : "rgb(200, 210, 225)",
    "star-intensity": t === "dark" ? 1.0 : 0,
  })

  /* ── Build all layers (called on ready & theme switch) ───── */
  const addAllLayers = useCallback(async (m: mapboxgl.Map) => {
    for (const id of ALL_LAYERS) { if (m.getLayer(id)) m.removeLayer(id) }
    for (const id of ALL_SOURCES) { if (m.getSource(id)) m.removeSource(id) }

    await loadSdfIcons(m)
    const cList = countriesRef.current

    /* ── 1. Country choropleth (vector tile source) ────────── */
    m.addSource("country-bounds", {
      type: "vector",
      url: "mapbox://mapbox.country-boundaries-v1",
    })

    m.addLayer({
      id: "country-fill",
      type: "fill",
      source: "country-bounds",
      "source-layer": "country_boundaries",
      filter: ["any",
        ["==", "all", ["get", "worldview"]],
        ["in", "US", ["get", "worldview"]],
      ],
      paint: {
        "fill-color": buildFillColor(cList, RISK_FILL),
        "fill-opacity": 1,
      },
    })

    m.addLayer({
      id: "country-border",
      type: "line",
      source: "country-bounds",
      "source-layer": "country_boundaries",
      filter: ["any",
        ["==", "all", ["get", "worldview"]],
        ["in", "US", ["get", "worldview"]],
      ],
      paint: {
        "line-color": buildFillColor(cList, RISK_BORDER),
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 1.5],
        "line-opacity": 1,
      },
    })

    // Country click & hover
    m.on("click", "country-fill", (e) => {
      const code = e.features?.[0]?.properties?.iso_3166_1
      if (code) selectCountry(code)
    })
    const cp = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "sentinel-popup", maxWidth: "220px", offset: 14 })
    m.on("mouseenter", "country-fill", (e) => {
      m.getCanvas().style.cursor = "pointer"
      const code = e.features?.[0]?.properties?.iso_3166_1
      if (!code) return
      const c = countriesRef.current.find(x => x.code === code)
      if (!c) return
      const color = RISK[c.riskLevel] || "#64748b"
      cp.setLngLat(e.lngLat)
        .setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${c.name}</div><div class="sentinel-popup-row"><span class="sentinel-popup-val" style="color:${color}">${c.score}</span><span class="sentinel-popup-badge" style="color:${color}">${c.riskLevel}</span></div></div>`)
        .addTo(m)
    })
    m.on("mousemove", "country-fill", (e) => cp.setLngLat(e.lngLat))
    m.on("mouseleave", "country-fill", () => { m.getCanvas().style.cursor = ""; cp.remove() })

    /* ── 2. Trade routes ─────────────────────────────────────── */
    m.addSource("routes", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: tradeRoutes.map((r) => {
          const wp = WAYPOINTS[r.id]
          const coords = wp ? catmullRom(wp, 32) : catmullRom([[r.from.lng,r.from.lat],[r.to.lng,r.to.lat]])
          return {
            type: "Feature" as const,
            properties: {
              color: RISK[r.riskLevel], risk: r.riskLevel,
              width: Math.max(1.5, Math.min(4, r.annualCargo / 300)),
              cargo: r.annualCargo, chokepoint: r.chokepoint,
              label: `${r.from.name} → ${r.to.name}`,
            },
            geometry: { type: "LineString" as const, coordinates: coords },
          }
        }),
      },
    })
    m.addLayer({ id: "routes-glow", type: "line", source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get","color"], "line-width": ["*",["get","width"],4], "line-opacity": 0.12, "line-blur": 6 },
    })
    m.addLayer({ id: "routes-line", type: "line", source: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get","color"], "line-width": ["get","width"], "line-opacity": 0.65 },
    })
    m.addLayer({ id: "routes-dash", type: "line", source: "routes",
      filter: ["in", ["get","risk"], ["literal",["HIGH","CRITICAL"]]],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.18, "line-dasharray": [2,6] },
    })

    const rp = new mapboxgl.Popup({ closeButton:false, closeOnClick:false, className:"sentinel-popup", maxWidth:"260px", offset:14 })
    m.on("mouseenter","routes-line",(e)=>{
      m.getCanvas().style.cursor="pointer"; const p=e.features?.[0]?.properties; if(!p) return
      const v=p.cargo>=1000?`$${(p.cargo/1000).toFixed(1)}B`:`$${p.cargo}M`
      rp.setLngLat(e.lngLat).setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${p.label}</div><div class="sentinel-popup-sub">${p.chokepoint}</div><div class="sentinel-popup-row"><span class="sentinel-popup-val" style="color:${p.color}">${v}/yr</span><span class="sentinel-popup-badge" style="color:${p.color}">${p.risk}</span></div></div>`).addTo(m)
    })
    m.on("mousemove","routes-line",(e)=>rp.setLngLat(e.lngLat))
    m.on("mouseleave","routes-line",()=>{m.getCanvas().style.cursor="";rp.remove()})

    /* ── 3. Country labels (GeoJSON points) ──────────────────── */
    m.addSource("countries", {
      type: "geojson",
      data: cList.length ? countryGeoJSON(cList) : { type: "FeatureCollection", features: [] },
    })
    m.addLayer({ id: "countries-labels", type: "symbol", source: "countries",
      filter: ["<=", ["get", "priority"], 2],
      layout: {
        "text-field": ["get", "label"],
        "text-size": ["match", ["get", "riskLevel"], "CRITICAL", 12, "HIGH", 11, 10],
        "text-offset": [0, 0], "text-anchor": "center",
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-allow-overlap": false, "text-optional": true, "text-padding": 4,
        "symbol-sort-key": ["get", "priority"], "text-letter-spacing": 0.05,
      },
      paint: { "text-color": ["get", "color"], "text-halo-color": "rgba(0,0,0,0.85)", "text-halo-width": 1.5, "text-halo-blur": 0.5 },
    })

    /* ── 4. Facilities ───────────────────────────────────────── */
    m.addSource("facilities", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: facilities.map((f) => ({
          type: "Feature" as const,
          properties: {
            name: f.name, location: f.location, fn: f.function,
            type: f.type, annualValue: f.annualValue,
            icon: `fac-${f.type}`, color: FAC_COLOR[f.type],
            label: f.name.split(" ")[0],
            valStr: f.annualValue >= 1000 ? `$${(f.annualValue/1000).toFixed(1)}B/yr`
              : f.annualValue > 0 ? `$${f.annualValue}M/yr` : "Hub",
          },
          geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
        })),
      },
    })
    m.addLayer({ id: "facilities-bg", type: "circle", source: "facilities",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 8, 5, 14],
        "circle-color": ["get", "color"], "circle-opacity": 0.15,
        "circle-stroke-width": 1.5, "circle-stroke-color": ["get", "color"], "circle-stroke-opacity": 0.6,
      },
    })
    m.addLayer({ id: "facilities-icon", type: "symbol", source: "facilities",
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.28, 5, 0.5],
        "icon-allow-overlap": true,
      },
      paint: { "icon-color": ["get", "color"], "icon-opacity": 0.9 },
    })
    m.addLayer({ id: "facilities-labels", type: "symbol", source: "facilities",
      layout: {
        "text-field": ["get", "label"],
        "text-size": 9, "text-offset": [0, 2.2], "text-anchor": "top",
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-allow-overlap": false, "text-optional": true,
        "text-letter-spacing": 0.05,
      },
      paint: { "text-color": ["get", "color"], "text-halo-color": "rgba(0,0,0,0.8)", "text-halo-width": 1.2 },
    })
    const fp = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "sentinel-popup", maxWidth: "240px", offset: 16 })
    m.on("mouseenter", "facilities-bg", (e) => {
      m.getCanvas().style.cursor = "pointer"; const p = e.features?.[0]?.properties; if (!p) return
      fp.setLngLat(e.lngLat).setHTML(`<div class="sentinel-popup-inner"><div class="sentinel-popup-title">${p.name}</div><div class="sentinel-popup-sub">${p.location}</div><div class="sentinel-popup-sub" style="margin-bottom:6px">${p.fn}</div><div class="sentinel-popup-val" style="color:${p.color};font-size:13px">${p.valStr}</div></div>`).addTo(m)
    })
    m.on("mousemove", "facilities-bg", (e) => fp.setLngLat(e.lngLat))
    m.on("mouseleave", "facilities-bg", () => { m.getCanvas().style.cursor = ""; fp.remove() })

    /* ── 5. Chokepoints ──────────────────────────────────────── */
    m.addSource("chokepoints", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: CHOKEPOINTS.map((chk) => ({
          type: "Feature" as const,
          properties: {
            name: chk.name, risk: chk.risk,
            color: RISK[chk.risk] || "#f97316",
          },
          geometry: { type: "Point" as const, coordinates: [chk.lng, chk.lat] },
        })),
      },
    })
    m.addLayer({ id: "chokepoints-icon", type: "symbol", source: "chokepoints",
      layout: {
        "icon-image": "chokepoint",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.22, 5, 0.4],
        "icon-allow-overlap": true,
      },
      paint: { "icon-color": ["get", "color"], "icon-opacity": 0.85 },
    })
    m.addLayer({ id: "chokepoints-labels", type: "symbol", source: "chokepoints",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 8, "text-offset": [0, 1.8], "text-anchor": "top",
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
        "text-letter-spacing": 0.1,
      },
      paint: { "text-color": ["get", "color"], "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5 },
    })
  }, [selectCountry])

  /* ── Init map ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapBox.current || map.current) return
    mapboxgl.accessToken = TOKEN
    const m = new mapboxgl.Map({
      container: mapBox.current,
      style: theme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
      center: [55, 20], zoom: 1.8, projection: "globe",
      attributionControl: false, logoPosition: "bottom-left", maxZoom: 8, minZoom: 1.2,
    })
    m.on("style.load", () => { m.setFog(fogFor(theme)); setReady(true) })
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [])

  /* ── Theme switch ──────────────────────────────────────────── */
  useEffect(() => {
    const m = map.current; if (!m) return
    if (firstStyle.current) { firstStyle.current = false; return }
    setReady(false)
    m.setStyle(theme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11")
    m.once("style.load", () => { m.setFog(fogFor(theme)); setReady(true) })
  }, [theme])

  /* ── Once ready → build layers ─────────────────────────────── */
  useEffect(() => {
    if (!ready || !map.current) return
    addAllLayers(map.current)
  }, [ready, addAllLayers])

  /* ── Country data update (choropleth + labels) ─────────────── */
  useEffect(() => {
    if (!ready || !map.current || !apiCountries?.length) return
    const m = map.current

    // Update choropleth paint
    if (m.getLayer("country-fill")) {
      m.setPaintProperty("country-fill", "fill-color", buildFillColor(apiCountries, RISK_FILL))
    }
    if (m.getLayer("country-border")) {
      m.setPaintProperty("country-border", "line-color", buildFillColor(apiCountries, RISK_BORDER))
    }

    // Update labels GeoJSON
    const src = m.getSource("countries") as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(countryGeoJSON(apiCountries))
  }, [ready, apiCountries])

  /* ── Fly to selection ──────────────────────────────────────── */
  useEffect(() => {
    const m = map.current; if (!m || !selectedCountryCode) return
    const found = apiCountries?.find((c) => c.code === selectedCountryCode)
    if (found) { m.flyTo({ center: [found.lng, found.lat], zoom: 4.5, duration: 1500, essential: true }) }
    else { const c = COUNTRY_COORDS[selectedCountryCode]; if (c) m.flyTo({ center: [c[1], c[0]], zoom: 4.5, duration: 1500, essential: true }) }
  }, [selectedCountryCode, apiCountries])

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="relative h-full w-full">
      <div ref={mapBox} className="h-full w-full" />
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1.5 backdrop-blur-sm border border-white/[0.06]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-data text-[9px] font-semibold tracking-widest text-white/60">
          LIVE — {apiCountries?.length ?? 0} NATIONS · {facilities.length} FACILITIES · {tradeRoutes.length} ROUTES
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-md bg-black/70 px-3 py-2 backdrop-blur-sm border border-white/[0.06]">
        <div className="flex items-center gap-3">
          {(["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: RISK[level], opacity: 0.7 }} />
              <span className="font-data text-[8px] font-medium tracking-wider text-white/50">{level}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Leg icon={<span className="h-2.5 w-2.5 rounded-sm border border-blue-400/40" style={{ background: "rgba(59,130,246,0.15)" }} />} label="REGION" />
          <Leg icon={<span className="inline-block h-3 w-3 rounded-full border border-[#60a5fa]/60" style={{ background: "#60a5fa20" }} />} label="FACILITY" />
          <Leg icon={<span className="inline-block" style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "8px solid #f97316" }} />} label="CHOKEPOINT" />
          <Leg icon={<span className="inline-block h-[2px] w-3 rounded-full bg-amber-400" />} label="ROUTE" />
        </div>
      </div>
    </div>
  )
}

function Leg({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className="font-data text-[8px] tracking-wider text-white/50">{label}</span>
    </div>
  )
}
