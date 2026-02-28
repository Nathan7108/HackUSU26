import { useMemo } from "react"
import { useHeadlines, useDashboard } from "@/hooks/use-dashboard"
import { flagFromAlpha2, toAlpha2 } from "@/lib/country-codes"
import { riskColor } from "@/lib/risk"
import type { RiskLevel } from "@/types"

export function NewsTicker() {
  const { data: headlinesData } = useHeadlines()
  const { dashboard } = useDashboard()

  const doubled = useMemo(() => {
    if (!headlinesData?.headlines) return []

    // Build a risk level lookup from dashboard countries
    const riskLookup: Record<string, RiskLevel> = {}
    if (dashboard?.countries) {
      for (const c of dashboard.countries) {
        const code2 = toAlpha2(c.code)
        riskLookup[code2] = c.riskLevel
      }
    }

    const items: Array<{ flag: string; code: string; riskLevel: RiskLevel; text: string; source: string }> = []

    for (const [code2, headlines] of Object.entries(headlinesData.headlines)) {
      const flag = flagFromAlpha2(code2)
      const risk = riskLookup[code2] ?? "MODERATE"
      for (const h of headlines) {
        if (h.text) {
          items.push({ flag, code: code2, riskLevel: risk, text: h.text, source: h.source })
        }
      }
    }

    if (items.length === 0) return []
    return [...items, ...items]
  }, [headlinesData, dashboard])

  if (doubled.length === 0) return null

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
