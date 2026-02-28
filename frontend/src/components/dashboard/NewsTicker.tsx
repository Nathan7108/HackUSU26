import type { Country } from "@/types"
import { riskColor } from "@/lib/risk"

interface NewsTickerProps {
  countries: Country[]
}

export function NewsTicker({ countries }: NewsTickerProps) {
  // Collect all headlines with country context
  const items = countries.flatMap((country) =>
    country.headlines.map((h) => ({
      flag: country.flag,
      code: country.code,
      riskLevel: country.riskLevel,
      ...h,
    })),
  )

  // Double for seamless loop
  const doubled = [...items, ...items]

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
          className="font-data text-[9px] font-bold tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          SIGACT
        </span>
      </div>

      {/* Scrolling content */}
      <div className="flex-1 overflow-hidden">
        <div className="animate-ticker flex items-center whitespace-nowrap">
          {doubled.map((item, i) => (
            <span key={i} className="mr-8 flex items-center gap-2">
              <span className="text-xs">{item.flag}</span>
              <span
                className="font-data text-[9px] font-semibold"
                style={{ color: riskColor[item.riskLevel] }}
              >
                {item.code}
              </span>
              <span
                className="text-[11px]"
                style={{ color: "var(--sentinel-text-secondary)" }}
              >
                {item.text}
              </span>
              <span
                className="font-data text-[9px]"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                — {item.source}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
