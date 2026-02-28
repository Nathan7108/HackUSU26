import { useState, useMemo } from "react"
import { useRouter } from "@tanstack/react-router"
import { countries } from "@/data"
import { riskColor, riskMutedColor, trendIcon, trendColor, formatScore } from "@/lib/risk"
import { Search, ArrowUpDown } from "lucide-react"
import type { RiskLevel } from "@/types"

type SortKey = "score" | "name" | "trend"

export function CountriesPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [filterRisk, setFilterRisk] = useState<RiskLevel | "ALL">("ALL")

  const filtered = useMemo(() => {
    let list = [...countries]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      )
    }

    if (filterRisk !== "ALL") {
      list = list.filter((c) => c.riskLevel === filterRisk)
    }

    list.sort((a, b) => {
      if (sortKey === "score") return b.score - a.score
      if (sortKey === "name") return a.name.localeCompare(b.name)
      return b.trendDelta - a.trendDelta
    })

    return list
  }, [search, sortKey, filterRisk])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <h1
            className="text-lg font-semibold"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            Country Risk Rankings
          </h1>
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {countries.length} COUNTRIES MONITORED — SORTED BY RISK SCORE
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div
            className="flex h-8 w-48 items-center gap-2 rounded-md px-2"
            style={{
              backgroundColor: "var(--sentinel-bg-elevated)",
              border: "1px solid var(--sentinel-border)",
            }}
          >
            <Search size={13} style={{ color: "var(--sentinel-text-tertiary)" }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--sentinel-text-primary)" }}
            />
          </div>

          {/* Risk filter */}
          <div className="flex items-center gap-1">
            {(["ALL", "CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilterRisk(level)}
                className="rounded px-2 py-1 font-data text-[9px] font-semibold transition-colors"
                style={{
                  backgroundColor:
                    filterRisk === level
                      ? level === "ALL"
                        ? "var(--sentinel-accent-muted)"
                        : (riskMutedColor as Record<string, string>)[level]
                      : "transparent",
                  color:
                    filterRisk === level
                      ? level === "ALL"
                        ? "var(--sentinel-accent)"
                        : (riskColor as Record<string, string>)[level]
                      : "var(--sentinel-text-tertiary)",
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="flex-1 overflow-y-auto rounded-md border"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          borderColor: "var(--sentinel-border-subtle)",
        }}
      >
        {/* Table header */}
        <div
          className="sticky top-0 z-10 grid grid-cols-[40px_1fr_80px_100px_80px_80px_60px] gap-2 border-b px-3 py-2"
          style={{
            backgroundColor: "var(--sentinel-bg-muted)",
            borderColor: "var(--sentinel-border-subtle)",
          }}
        >
          <span className="font-data text-[9px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>#</span>
          <HeaderCell label="COUNTRY" sortKey="name" currentSort={sortKey} onSort={setSortKey} />
          <HeaderCell label="SCORE" sortKey="score" currentSort={sortKey} onSort={setSortKey} />
          <span className="font-data text-[9px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>RISK</span>
          <HeaderCell label="TREND" sortKey="trend" currentSort={sortKey} onSort={setSortKey} />
          <span className="font-data text-[9px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>CONF</span>
          <span className="font-data text-[9px] font-bold tracking-wider text-center" style={{ color: "var(--sentinel-text-tertiary)" }}>ANOM</span>
        </div>

        {/* Rows */}
        {filtered.map((country, index) => (
          <button
            key={country.code}
            onClick={() => router.navigate({ to: "/country/$code", params: { code: country.code } })}
            className="grid w-full grid-cols-[40px_1fr_80px_100px_80px_80px_60px] gap-2 border-b px-3 py-2.5 text-left transition-colors"
            style={{ borderColor: "var(--sentinel-border-subtle)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
            }}
          >
            <span
              className="font-data text-xs"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {index + 1}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm">{country.flag}</span>
              <div className="flex flex-col">
                <span className="text-xs font-medium" style={{ color: "var(--sentinel-text-primary)" }}>
                  {country.name}
                </span>
                <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
                  {country.code}
                </span>
              </div>
            </div>
            <span
              className="font-data text-sm font-bold"
              style={{ color: riskColor[country.riskLevel] }}
            >
              {formatScore(country.score)}
            </span>
            <span
              className="inline-flex w-fit items-center rounded px-1.5 py-0.5 font-data text-[9px] font-semibold"
              style={{
                backgroundColor: riskMutedColor[country.riskLevel],
                color: riskColor[country.riskLevel],
              }}
            >
              {country.riskLevel}
            </span>
            <span
              className="font-data text-xs font-semibold"
              style={{ color: trendColor[country.trend] }}
            >
              {trendIcon[country.trend]} {country.trendDelta > 0 ? "+" : ""}{country.trendDelta}
            </span>
            <span
              className="font-data text-xs"
              style={{ color: "var(--sentinel-text-secondary)" }}
            >
              {Math.round(country.confidence * 100)}%
            </span>
            <div className="flex items-center justify-center">
              {country.isAnomaly && (
                <span
                  className="h-2.5 w-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "var(--risk-critical)" }}
                />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function HeaderCell({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  onSort: (key: SortKey) => void
}) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-data text-[9px] font-bold tracking-wider"
      style={{
        color: currentSort === sortKey ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
      }}
    >
      {label}
      <ArrowUpDown size={9} />
    </button>
  )
}
