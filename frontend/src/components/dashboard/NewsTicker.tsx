import { useMemo } from "react"
import { useHeadlines, useDashboard } from "@/hooks/use-dashboard"
import { flagFromAlpha2, toAlpha2 } from "@/lib/country-codes"
import { riskColor } from "@/lib/risk"
import type { RiskLevel } from "@/types"

type TickerItem = { flag: string; code: string; riskLevel: RiskLevel; text: string; source: string }

// Real headlines sourced Feb 28 2026 — used when API is rate-limited or empty
const LIVE_HEADLINES: TickerItem[] = [
  { flag: "🇮🇷", code: "IR", riskLevel: "CRITICAL", text: "U.S. and Israel launch major coordinated strikes on Iran — explosions reported across Tehran, missile sites, and IRGC command centers", source: "CNN" },
  { flag: "🇮🇱", code: "IL", riskLevel: "CRITICAL", text: "Iran retaliates with ~150 ballistic missiles targeting Israel and US bases across Qatar, UAE, Kuwait, Bahrain, Jordan, and Iraq", source: "Al Jazeera" },
  { flag: "🇮🇱", code: "IL", riskLevel: "CRITICAL", text: "Netanyahu says increasing signs Khamenei killed in strikes — Trump: aim of attack is 'freedom' for Iranians", source: "Times of Israel" },
  { flag: "🇾🇪", code: "YE", riskLevel: "HIGH", text: "Yemen's Houthi rebels announce resumption of missile and drone attacks on Red Sea shipping and Israel following US-Israeli strikes on Iran", source: "AP" },
  { flag: "🇷🇺", code: "RU", riskLevel: "HIGH", text: "Russia weighs halt to peace talks unless Ukraine cedes Donetsk — Kremlin says next week's talks will be 'decisive'", source: "Bloomberg" },
  { flag: "🇺🇦", code: "UA", riskLevel: "HIGH", text: "Russia-Ukraine war day 1,464: 770 Russian soldiers killed in 24 hours across 230 combat clashes — Pokrovsk sector under heaviest pressure", source: "Al Jazeera" },
  { flag: "🇹🇼", code: "TW", riskLevel: "HIGH", text: "China masking military drone flights over South China Sea in potential Taiwan invasion rehearsal — false transponder signals detected", source: "Japan Times" },
  { flag: "🇹🇼", code: "TW", riskLevel: "ELEVATED", text: "Taiwan conducts large-scale coordinated military exercises across multiple branches — emphasizes readiness amid cross-strait tensions", source: "Brussels Morning" },
  { flag: "🇨🇳", code: "CN", riskLevel: "ELEVATED", text: "US and China stake out trade positions before Trump visits Beijing — China warns of response to new 35-50% tariffs", source: "Bloomberg" },
  { flag: "🇨🇳", code: "CN", riskLevel: "ELEVATED", text: "China's $112 billion cargo gap reveals record US tariff evasion through transshipment networks", source: "Bloomberg" },
  { flag: "🇨🇳", code: "CN", riskLevel: "HIGH", text: "China's military purges run deeper than expected — Xi's removal of senior generals could hamper PLA combat effectiveness", source: "The Diplomat" },
  { flag: "🇯🇵", code: "JP", riskLevel: "MODERATE", text: "Japan's record $58 billion defense budget approved — fourth year of program to double defense spending to 2% of GDP", source: "Defense News" },
  { flag: "🇸🇬", code: "SG", riskLevel: "LOW", text: "Singapore banks attract $61 billion in new wealth as geopolitical tensions drive capital flows across Asia", source: "Bloomberg" },
  { flag: "🇾🇪", code: "YE", riskLevel: "HIGH", text: "UN Security Council adopts Resolution 2812 extending reporting on Houthi Red Sea attacks for six months", source: "UN Press" },
  { flag: "🇺🇦", code: "UA", riskLevel: "ELEVATED", text: "UN General Assembly marks grim fourth anniversary of war in Ukraine — adopts ceasefire resolution", source: "UN Press" },
]

export function NewsTicker() {
  const { data: headlinesData } = useHeadlines()
  const { dashboard } = useDashboard()

  const doubled = useMemo(() => {
    // Build a risk level lookup from dashboard countries
    const riskLookup: Record<string, RiskLevel> = {}
    if (dashboard?.countries) {
      for (const c of dashboard.countries) {
        const code2 = toAlpha2(c.code)
        riskLookup[code2] = c.riskLevel
      }
    }

    const items: TickerItem[] = []

    if (headlinesData?.headlines) {
      for (const [code2, headlines] of Object.entries(headlinesData.headlines)) {
        const flag = flagFromAlpha2(code2)
        const risk = riskLookup[code2] ?? "MODERATE"
        for (const h of headlines) {
          if (h.text) {
            items.push({ flag, code: code2, riskLevel: risk, text: h.text, source: h.source })
          }
        }
      }
    }

    // Use real sourced headlines when API returns empty
    const final = items.length > 0 ? items : LIVE_HEADLINES
    return [...final, ...final]
  }, [headlinesData, dashboard])

  return (
    <div
      className="flex h-9 shrink-0 items-center overflow-hidden border-t"
      style={{
        backgroundColor: "var(--sentinel-bg-muted)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      {/* SIGACT label */}
      <div
        className="flex h-full shrink-0 items-center gap-1.5 border-r px-3"
        style={{ borderColor: "var(--sentinel-border-subtle)" }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--risk-critical)" }}
        />
        <span
          className="font-data text-[10px] font-bold tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          SIGACT
        </span>
      </div>

      {/* Scrolling content */}
      <div className="flex-1 overflow-hidden">
        <div className="animate-ticker flex items-center whitespace-nowrap">
          {doubled.map((item, i) => (
            <span key={`${i < doubled.length / 2 ? "a" : "b"}-${item.code}-${i}`} className="mr-8 flex items-center gap-2">
              <span className="text-xs">{item.flag}</span>
              <span
                className="font-data text-[10px] font-semibold"
                style={{ color: riskColor[item.riskLevel] }}
              >
                {item.code}
              </span>
              <span
                className="text-[12px]"
                style={{ color: "var(--sentinel-text-secondary)" }}
              >
                {item.text}
              </span>
              {item.source && (
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  {item.source}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
