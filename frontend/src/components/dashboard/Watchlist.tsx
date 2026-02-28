import type { Country } from "@/types"
import { riskColor, riskMutedColor, trendIcon, trendColor, formatScore } from "@/lib/risk"
import { useAppStore } from "@/stores/app"

interface WatchlistProps {
  countries: Country[]
}

export function Watchlist({ countries }: WatchlistProps) {
  const top = countries.slice(0, 7)
  const { selectCountry, selectedCountryCode } = useAppStore()

  return (
    <div
      className="flex flex-col rounded-md border"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--sentinel-border-subtle)" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          Priority Watchlist
        </span>
        <span
          className="font-data text-[10px]"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {countries.length} COUNTRIES
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {top.map((country) => (
          <WatchlistRow
            key={country.code}
            country={country}
            isSelected={country.code === selectedCountryCode}
            onClick={() => selectCountry(country.code)}
          />
        ))}
      </div>
    </div>
  )
}

function WatchlistRow({
  country,
  isSelected,
  onClick,
}: {
  country: Country
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 border-b px-3 py-2 text-left transition-colors last:border-b-0"
      style={{
        borderColor: "var(--sentinel-border-subtle)",
        backgroundColor: isSelected
          ? "var(--sentinel-bg-elevated)"
          : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"
      }}
    >
      {/* Flag + Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base leading-none">{country.flag}</span>
        <div className="flex flex-col min-w-0">
          <span
            className="text-xs font-medium truncate"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            {country.name}
          </span>
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {country.code}
          </span>
        </div>
      </div>

      {/* Score */}
      <span
        className="font-data text-sm font-bold tabular-nums"
        style={{ color: riskColor[country.riskLevel] }}
      >
        {formatScore(country.score)}
      </span>

      {/* Risk badge */}
      <span
        className="rounded px-1.5 py-0.5 font-data text-[9px] font-semibold"
        style={{
          backgroundColor: riskMutedColor[country.riskLevel],
          color: riskColor[country.riskLevel],
        }}
      >
        {country.riskLevel}
      </span>

      {/* Trend */}
      <span
        className="font-data text-[11px] font-semibold w-8 text-right"
        style={{ color: trendColor[country.trend] }}
      >
        {trendIcon[country.trend]}
        {country.trendDelta > 0 ? "+" : ""}
        {country.trendDelta}
      </span>

      {/* Anomaly indicator */}
      {country.isAnomaly && (
        <span
          className="h-2 w-2 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--risk-critical)" }}
          title="Anomaly detected"
        />
      )}
    </button>
  )
}
