import { useState } from "react"
import { Plus, X, Search } from "lucide-react"
import type { Country } from "@/types"
import { riskColor, riskMutedColor, trendIcon, trendColor, formatScore } from "@/lib/risk"
import { useAppStore } from "@/stores/app"

interface WatchlistProps {
  countries: Country[]
}

export function Watchlist({ countries }: WatchlistProps) {
  const top = countries.slice(0, 12)
  const { selectCountry, selectedCountryCode } = useAppStore()
  const [showAddModal, setShowAddModal] = useState(false)

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
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          Priority Watchlist
        </span>
        <div className="flex items-center gap-2">
          <span
            className="font-data text-[11px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {top.length} / {countries.length}
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center rounded p-0.5 transition-colors"
            style={{ color: "var(--sentinel-text-tertiary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
              e.currentTarget.style.color = "var(--sentinel-accent)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "var(--sentinel-text-tertiary)"
            }}
            title="Add country to watchlist"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
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

      {/* Add Country Modal */}
      {showAddModal && (
        <AddCountryModal
          countries={countries}
          watchedCodes={new Set(top.map((c) => c.code))}
          onClose={() => setShowAddModal(false)}
        />
      )}
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
      {/* Code + Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="font-data text-[11px] font-bold tracking-wide shrink-0"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {country.code}
        </span>
        <span
          className="text-xs font-medium truncate"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          {country.name}
        </span>
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
        className="rounded px-1.5 py-0.5 font-data text-[10px] font-semibold"
        style={{
          backgroundColor: riskMutedColor[country.riskLevel],
          color: riskColor[country.riskLevel],
        }}
      >
        {country.riskLevel}
      </span>

      {/* Trend */}
      <span
        className="font-data text-[12px] font-semibold w-8 text-right"
        style={{ color: trendColor[country.trend] }}
      >
        {trendIcon[country.trend]}
        {country.trendDelta > 0 ? "+" : ""}
        {country.trendDelta}
      </span>
    </button>
  )
}

function AddCountryModal({
  countries,
  watchedCodes,
  onClose,
}: {
  countries: Country[]
  watchedCodes: Set<string>
  onClose: () => void
}) {
  const [search, setSearch] = useState("")

  const filtered = countries
    .filter((c) => !watchedCodes.has(c.code))
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 8)

  return (
    <div
      className="border-t px-3 py-2"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
    >
      {/* Search header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex flex-1 items-center gap-1.5 rounded px-2 py-1"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            border: "1px solid var(--sentinel-border-subtle)",
          }}
        >
          <Search size={12} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search countries..."
            autoFocus
            className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
            style={{ color: "var(--sentinel-text-primary)" }}
          />
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded p-1 transition-colors"
          style={{ color: "var(--sentinel-text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent"
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-0.5">
        {filtered.map((c) => (
          <button
            key={c.code}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
            style={{ color: "var(--sentinel-text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
            }}
            onClick={onClose}
          >
            <Plus size={12} style={{ color: "var(--sentinel-accent)" }} />
            <span className="font-data text-[11px] font-bold shrink-0" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {c.code}
            </span>
            <span className="text-xs truncate">{c.name}</span>
            <span
              className="ml-auto font-data text-[10px] font-semibold rounded px-1 py-0.5"
              style={{
                backgroundColor: riskMutedColor[c.riskLevel],
                color: riskColor[c.riskLevel],
              }}
            >
              {c.score}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="px-2 py-1 text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            No matching countries
          </span>
        )}
      </div>
    </div>
  )
}
