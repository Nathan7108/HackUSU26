import { useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { useAppStore } from "@/stores/app"

/**
 * Global demo-mode keyboard shortcuts — works on ALL pages.
 *
 * Key map:
 *   1 → Globe overview (navigate to /dashboard)
 *   2 → Fly to Taiwan
 *   3 → Fly to China
 *   4 → Fly to Yemen / Red Sea
 *   5 → Actions / Mitigation Portfolio
 *   0 → Reset to full globe + restart spin
 *  Esc → Close IntelPanel
 *
 * Mount this in __root.tsx so shortcuts work everywhere.
 * Map flyTo is handled by GlobeMap's selectedCountryCode useEffect.
 * If the map isn't mounted yet (e.g. on /actions), navigation keys
 * route to /dashboard first — the map will pick up the state on mount.
 */

const OVERVIEW = { center: [55, 20] as [number, number], zoom: 1.5, pitch: 0, bearing: 0, duration: 2500 }

export function useDemoMode() {
  const { isDemoMode, selectCountry, setIntelPanelOpen } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (!isDemoMode) return

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return

      const map = useAppStore.getState().mapInstance
      // Stop spin for any country navigation key
      if (map && ["1", "2", "3", "4"].includes(e.key)) (map as any)._stopSpin?.()

      switch (e.key) {
        // ── 1: Globe overview ──
        case "1": {
          e.preventDefault()
          selectCountry(null)
          setIntelPanelOpen(false)
          router.navigate({ to: "/dashboard" })
          if (map) map.flyTo({ ...OVERVIEW, essential: true })
          break
        }

        // ── 2: Taiwan — THE ALERT ──
        case "2": {
          e.preventDefault()
          router.navigate({ to: "/dashboard" })
          selectCountry("TWN")
          break
        }

        // ── 3: China — rare earth alert ──
        case "3": {
          e.preventDefault()
          router.navigate({ to: "/dashboard" })
          selectCountry("CHN")
          break
        }

        // ── 4: Red Sea / Yemen — shipping risk ──
        case "4": {
          e.preventDefault()
          router.navigate({ to: "/dashboard" })
          selectCountry("YEM")
          break
        }

        // ── 5: Actions / Mitigation Portfolio page ──
        case "5": {
          e.preventDefault()
          router.navigate({ to: "/actions" })
          break
        }

        // ── 0: Reset — full globe, close everything, restart spin ──
        case "0": {
          e.preventDefault()
          selectCountry(null)
          setIntelPanelOpen(false)
          router.navigate({ to: "/dashboard" })
          if (map) {
            ;(map as any)._stopSpin?.()
            map.flyTo({ ...OVERVIEW, essential: true })
            map.once("moveend", () => { ;(map as any)._startSpin?.() })
          }
          break
        }

        // ── Esc: Close panel only ──
        case "Escape":
          setIntelPanelOpen(false)
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isDemoMode, selectCountry, setIntelPanelOpen, router])
}
