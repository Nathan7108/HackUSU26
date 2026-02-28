import { useRef, useEffect, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import { useAppStore } from "@/stores/app"
import { useThemeStore } from "@/stores/theme"
import { countries, facilities, tradeRoutes } from "@/data"
import type { Country, Facility, TradeRoute } from "@/types"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Risk level to color
const riskHex: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  ELEVATED: "#eab308",
  MODERATE: "#3b82f6",
  LOW: "#22c55e",
}

// Facility type to color
const facilityHex: Record<string, string> = {
  hq: "#3b82f6",
  manufacturing: "#22c55e",
  processing: "#eab308",
  assembly: "#a855f7",
  distribution: "#64748b",
}

export function GlobeMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const { selectCountry, selectedCountryCode } = useAppStore()
  const { theme } = useThemeStore()
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: theme === "dark"
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11",
      center: [40, 20],
      zoom: 1.8,
      projection: "globe",
      attributionControl: false,
      logoPosition: "bottom-left",
      maxZoom: 8,
      minZoom: 1.2,
    })

    map.on("style.load", () => {
      // Atmosphere for globe feel
      map.setFog({
        color: theme === "dark" ? "rgb(15, 20, 25)" : "rgb(220, 230, 240)",
        "high-color": theme === "dark" ? "rgb(20, 30, 50)" : "rgb(180, 200, 230)",
        "horizon-blend": 0.04,
        "space-color": theme === "dark" ? "rgb(10, 14, 18)" : "rgb(200, 210, 225)",
        "star-intensity": theme === "dark" ? 0.4 : 0,
      })

      setMapLoaded(true)
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update style on theme change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const style = theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11"

    map.setStyle(style)

    map.once("style.load", () => {
      map.setFog({
        color: theme === "dark" ? "rgb(15, 20, 25)" : "rgb(220, 230, 240)",
        "high-color": theme === "dark" ? "rgb(20, 30, 50)" : "rgb(180, 200, 230)",
        "horizon-blend": 0.04,
        "space-color": theme === "dark" ? "rgb(10, 14, 18)" : "rgb(200, 210, 225)",
        "star-intensity": theme === "dark" ? 0.4 : 0,
      })

      addLayers(map)
    })
  }, [theme])

  // Add all map layers after style is loaded
  const addLayers = useCallback((map: mapboxgl.Map) => {
    // Clean up old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // --- Trade route arcs as GeoJSON lines ---
    const routeFeatures = tradeRoutes.map((route) => ({
      type: "Feature" as const,
      properties: {
        id: route.id,
        riskLevel: route.riskLevel,
        color: riskHex[route.riskLevel],
        chokepoint: route.chokepoint,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: createArc(
          [route.from.lng, route.from.lat],
          [route.to.lng, route.to.lat],
        ),
      },
    }))

    if (!map.getSource("trade-routes")) {
      map.addSource("trade-routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: routeFeatures },
      })

      map.addLayer({
        id: "trade-routes-line",
        type: "line",
        source: "trade-routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.5,
          "line-opacity": 0.6,
          "line-dasharray": [2, 2],
        },
      })
    }

    // --- Country risk markers (HTML markers for pulse animation) ---
    countries.forEach((country) => {
      const el = createCountryMarker(country)
      el.addEventListener("click", () => {
        selectCountry(country.code)
      })

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([country.lng, country.lat])
        .addTo(map)

      markersRef.current.push(marker)
    })

    // --- Facility markers ---
    facilities.forEach((facility) => {
      const el = createFacilityMarker(facility)

      const popup = new mapboxgl.Popup({
        offset: 12,
        closeButton: false,
        className: "sentinel-popup",
      }).setHTML(`
        <div style="font-family: 'Inter', sans-serif; font-size: 11px; padding: 4px 0;">
          <div style="font-weight: 600; margin-bottom: 2px;">${facility.name}</div>
          <div style="opacity: 0.7; font-size: 10px;">${facility.location}</div>
          <div style="opacity: 0.7; font-size: 10px;">${facility.function}</div>
          ${facility.annualValue > 0 ? `<div style="font-family: 'JetBrains Mono', monospace; font-weight: 600; margin-top: 4px; color: ${facilityHex[facility.type]};">$${facility.annualValue}M/yr</div>` : ""}
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([facility.lng, facility.lat])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [selectCountry])

  // Add layers when map is loaded
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      addLayers(mapRef.current)
    }
  }, [mapLoaded, addLayers])

  // Fly to selected country
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedCountryCode) return

    const country = countries.find((c) => c.code === selectedCountryCode)
    if (country) {
      map.flyTo({
        center: [country.lng, country.lat],
        zoom: 4.5,
        duration: 1500,
        essential: true,
      })
    }
  }, [selectedCountryCode])

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Globe overlay label */}
      <div
        className="absolute top-3 left-3 flex items-center gap-2 rounded-md px-2 py-1"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          border: "1px solid var(--sentinel-border-subtle)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--risk-low)" }}
        />
        <span
          className="font-data text-[9px] font-semibold tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          LIVE — {countries.length} MONITORED
        </span>
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md px-2.5 py-1.5"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          border: "1px solid var(--sentinel-border-subtle)",
        }}
      >
        {(["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((level) => (
          <div key={level} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: riskHex[level] }}
            />
            <span
              className="font-data text-[8px] tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {level}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Create curved arc between two points
function createArc(
  start: [number, number],
  end: [number, number],
  numPoints = 50,
): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const lng = start[0] + (end[0] - start[0]) * t
    const lat = start[1] + (end[1] - start[1]) * t

    // Add curvature based on distance
    const dist = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2),
    )
    const maxElevation = dist * 0.15
    const elevation = Math.sin(t * Math.PI) * maxElevation

    points.push([lng, lat + elevation])
  }
  return points
}

// Create country risk marker
function createCountryMarker(country: Country): HTMLElement {
  const size = country.riskLevel === "CRITICAL" ? 24 : country.riskLevel === "HIGH" ? 20 : 16
  const color = riskHex[country.riskLevel]

  const el = document.createElement("div")
  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    cursor: pointer;
    position: relative;
  `

  // Inner dot
  const dot = document.createElement("div")
  dot.style.cssText = `
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: ${color};
    opacity: 0.9;
    box-shadow: 0 0 ${size}px ${color}40;
  `
  el.appendChild(dot)

  // Pulse ring for anomalies and critical
  if (country.isAnomaly || country.riskLevel === "CRITICAL") {
    const ring = document.createElement("div")
    ring.style.cssText = `
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid ${color};
      animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    `
    el.appendChild(ring)
  }

  // Score label
  const label = document.createElement("div")
  label.style.cssText = `
    position: absolute;
    top: ${size + 2}px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: ${color};
    white-space: nowrap;
    text-shadow: 0 0 4px rgba(0,0,0,0.8);
  `
  label.textContent = `${country.code} ${country.score}`
  el.appendChild(label)

  return el
}

// Create facility marker
function createFacilityMarker(facility: Facility): HTMLElement {
  const color = facilityHex[facility.type]
  const el = document.createElement("div")
  el.style.cssText = `
    width: 10px;
    height: 10px;
    border: 2px solid ${color};
    border-radius: 2px;
    background: ${color}40;
    cursor: pointer;
    transform: rotate(45deg);
  `
  return el
}
