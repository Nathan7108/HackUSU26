import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import {
  fetchCountriesList,
  fetchDashboardSummary,
  type ApiCountryListItem,
  type BackendCountryRow,
} from "@/lib/api"
import { applyOverrides } from "@/lib/live-overrides"
import { useExposure } from "@/hooks/use-dashboard"
import { toAlpha3, flagFromAlpha2 } from "@/lib/country-codes"
import {
  riskColor,
  riskMutedColor,
  trendIcon,
  trendColor,
  formatScore,
  formatMoney,
} from "@/lib/risk"
import {
  Search,
  ArrowUpDown,
  Loader2,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import type { RiskLevel, Trend } from "@/types"

type SortKey = "score" | "name" | "trend" | "delta"
type SortDir = "asc" | "desc"

const RISK_LEVELS: RiskLevel[] = ["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"]
const PAGE_SIZE = 25

function toRiskLevel(s: string): RiskLevel {
  const u = s.toUpperCase()
  if (u === "CRITICAL" || u === "HIGH" || u === "ELEVATED" || u === "MODERATE" || u === "LOW") return u as RiskLevel
  return "MODERATE"
}

function toTrend(delta: number): Trend {
  if (delta > 1) return "ESCALATING"
  if (delta < -1) return "DE-ESCALATING"
  return "STABLE"
}

/** Merged country row for the table — built from /api/countries + dashboard summary enrichment */
interface CountryListRow {
  code2: string
  code3: string
  flag: string
  name: string
  score: number
  riskLevel: RiskLevel
  trendDelta: number
  trend: Trend
  confidence: number
  isAnomaly: boolean
  anomalyScore: number
  brief: string
}

function buildRows(
  allCountries: ApiCountryListItem[],
  summaryLookup: Map<string, BackendCountryRow>,
): CountryListRow[] {
  return allCountries.map((c) => {
    const enriched = summaryLookup.get(c.countryCode.toUpperCase())
    const delta = enriched?.scoreDelta ?? 0
    const riskLevel = toRiskLevel(enriched?.riskLevel ?? c.riskLevel)
    return {
      code2: c.countryCode,
      code3: toAlpha3(c.countryCode),
      flag: flagFromAlpha2(c.countryCode),
      name: c.country,
      score: enriched?.riskScore ?? c.riskScore,
      riskLevel,
      trendDelta: delta,
      trend: toTrend(delta),
      confidence: 0.85,
      isAnomaly: enriched?.isAnomaly ?? false,
      anomalyScore: enriched?.anomalyScore ?? 0,
      brief: `${c.country} is assessed at ${riskLevel} risk (${enriched?.riskScore ?? c.riskScore}/100).`,
    }
  })
}

export function CountriesPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [filterRisk, setFilterRisk] = useState<RiskLevel | "ALL">("ALL")
  const [page, setPage] = useState(0)

  // Fetch ALL countries from /api/countries
  const countriesQuery = useQuery({
    queryKey: ["countries-list"],
    queryFn: fetchCountriesList,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
  })

  // Fetch dashboard summary for enrichment (anomaly, delta, etc.)
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const raw = await fetchDashboardSummary()
      return applyOverrides(raw)
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
  })

  const { data: exposureData } = useExposure()

  // Build enrichment lookup from dashboard summary
  const summaryLookup = useMemo(() => {
    const map = new Map<string, BackendCountryRow>()
    if (summaryQuery.data?.countries) {
      for (const c of summaryQuery.data.countries) {
        map.set(c.code.toUpperCase(), c)
      }
    }
    return map
  }, [summaryQuery.data])

  // Merge: every country from /api/countries, enriched with summary data
  const countries = useMemo(() => {
    if (!countriesQuery.data) return []
    return buildRows(countriesQuery.data, summaryLookup)
  }, [countriesQuery.data, summaryLookup])

  // Exposure lookup by alpha-3
  const exposureByCode = useMemo(() => {
    if (!exposureData?.countryExposure) return {}
    const map: Record<string, number> = {}
    for (const [, exp] of Object.entries(exposureData.countryExposure)) {
      if (exp.countryCode) map[exp.countryCode.toUpperCase()] = exp.totalExposure
    }
    return map
  }, [exposureData])

  // Risk distribution counts
  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 0, ELEVATED: 0, MODERATE: 0, LOW: 0 }
    for (const c of countries) counts[c.riskLevel]++
    return counts
  }, [countries])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc") }
    setPage(0)
  }

  const filtered = useMemo(() => {
    let list = [...countries]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.code3.toLowerCase().includes(q) || c.code2.toLowerCase().includes(q))
    }
    if (filterRisk !== "ALL") list = list.filter((c) => c.riskLevel === filterRisk)
    const dir = sortDir === "desc" ? -1 : 1
    list.sort((a, b) => {
      if (sortKey === "score") return (a.score - b.score) * dir
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir
      return (a.trendDelta - b.trendDelta) * dir
    })
    return list
  }, [countries, search, sortKey, sortDir, filterRisk])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length)
  const pageItems = filtered.slice(pageStart, pageEnd)

  const anomalyCount = countries.filter((c) => c.isAnomaly).length
  const escalatingCount = countries.filter((c) => c.trend === "ESCALATING").length

  // ── Loading ──
  if (countriesQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span className="font-data text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>Loading country risk data...</span>
        </div>
      </div>
    )
  }

  // ── Error ──
  if (countriesQuery.isError || !countriesQuery.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="h-8 w-8" style={{ color: "var(--risk-elevated)" }} />
          <span className="text-lg font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>Backend Unavailable</span>
          <span className="text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>
            {countriesQuery.error?.message ?? "Unable to connect to the Sentinel API. Ensure the backend is running."}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-4">
      {/* ── Page Header ── */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
            Country Risk Rankings
          </h1>
          <span className="font-data text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {countries.length} COUNTRIES MONITORED — REAL-TIME ML ANALYSIS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--risk-low)" }} />
          <span className="font-data text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>LIVE</span>
        </div>
      </div>

      {/* ── Risk Distribution Strip ── */}
      <div className="mb-2 grid grid-cols-5 gap-2">
        {RISK_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => { setFilterRisk((prev) => (prev === level ? "ALL" : level)); setPage(0) }}
            className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-all"
            style={{
              backgroundColor: filterRisk === level ? riskMutedColor[level] : "var(--sentinel-bg-surface)",
              borderColor: filterRisk === level ? riskColor[level] : "var(--sentinel-border-subtle)",
            }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded" style={{ backgroundColor: riskMutedColor[level] }}>
              <span className="font-data text-base font-bold" style={{ color: riskColor[level] }}>{riskCounts[level]}</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-data text-[12px] font-bold tracking-wider" style={{ color: riskColor[level] }}>{level}</span>
              <span className="text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>{riskCounts[level] === 1 ? "country" : "countries"}</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Summary Stats Row ── */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}>
          <Shield size={16} style={{ color: "var(--sentinel-accent)" }} />
          <div className="flex flex-col">
            <span className="font-data text-base font-bold" style={{ color: "var(--sentinel-text-primary)" }}>{countries.length}</span>
            <span className="text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>Total Monitored</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}>
          <TrendingUp size={16} style={{ color: "var(--risk-critical)" }} />
          <div className="flex flex-col">
            <span className="font-data text-base font-bold" style={{ color: "var(--risk-critical)" }}>{escalatingCount}</span>
            <span className="text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>Escalating</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}>
          <Activity size={16} style={{ color: "var(--risk-high)" }} />
          <div className="flex flex-col">
            <span className="font-data text-base font-bold" style={{ color: "var(--risk-high)" }}>{anomalyCount}</span>
            <span className="text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>Anomalies Detected</span>
          </div>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div className="mb-2 flex items-center justify-between rounded-lg border px-3 py-1.5" style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}>
        <div className="flex h-8 w-60 items-center gap-2 rounded-md px-2.5" style={{ backgroundColor: "var(--sentinel-bg-elevated)", border: "1px solid var(--sentinel-border)" }}>
          <Search size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <input
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--sentinel-text-primary)" }}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>Filter:</span>
          {(["ALL", ...RISK_LEVELS] as const).map((level) => (
            <button
              key={level}
              onClick={() => { setFilterRisk(level); setPage(0) }}
              className="rounded px-2.5 py-1 font-data text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: filterRisk === level ? (level === "ALL" ? "var(--sentinel-accent-muted)" : (riskMutedColor as Record<string, string>)[level]) : "transparent",
                color: filterRisk === level ? (level === "ALL" ? "var(--sentinel-accent)" : (riskColor as Record<string, string>)[level]) : "var(--sentinel-text-tertiary)",
              }}
            >
              {level}
            </button>
          ))}
        </div>
        <span className="font-data text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
        </span>
      </div>

      {/* ── Data Table ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border" style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}>
        {/* Table header */}
        <div
          className="grid grid-cols-[40px_200px_1fr_100px_96px_76px_80px_44px] items-center gap-2 border-b px-4 py-2"
          style={{ backgroundColor: "var(--sentinel-bg-muted)", borderColor: "var(--sentinel-border-subtle)" }}
        >
          <HeaderLabel>#</HeaderLabel>
          <SortableHeader label="COUNTRY" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <HeaderLabel>ASSESSMENT</HeaderLabel>
          <SortableHeader label="RISK SCORE" sortKey="score" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <HeaderLabel>RISK LEVEL</HeaderLabel>
          <SortableHeader label="24H Δ" sortKey="delta" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortableHeader label="TREND" sortKey="trend" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <HeaderLabel className="text-center">ANOM</HeaderLabel>
        </div>

        {/* Scrollable rows */}
        <div className="flex-1 overflow-y-auto">
          {pageItems.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm" style={{ color: "var(--sentinel-text-tertiary)" }}>No countries match your criteria</span>
            </div>
          ) : (
            pageItems.map((row, index) => (
              <CountryRow
                key={row.code2}
                row={row}
                rank={pageStart + index + 1}
                exposure={exposureByCode[row.code3]}
                onClick={() => router.navigate({ to: "/country/$code", params: { code: row.code3 } })}
              />
            ))
          )}
        </div>

        {/* ── Pagination Footer ── */}
        <div className="flex items-center justify-between border-t px-4 py-2" style={{ backgroundColor: "var(--sentinel-bg-muted)", borderColor: "var(--sentinel-border-subtle)" }}>
          <span className="font-data text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
            Showing {filtered.length === 0 ? 0 : pageStart + 1}–{pageEnd} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="flex h-8 items-center gap-1 rounded-md px-3 font-data text-xs font-semibold transition-colors disabled:opacity-30"
              style={{ color: "var(--sentinel-text-secondary)" }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="flex h-8 w-8 items-center justify-center rounded-md font-data text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: i === safePage ? "var(--sentinel-accent-muted)" : "transparent",
                  color: i === safePage ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
                }}
                onMouseEnter={(e) => { if (i !== safePage) e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
                onMouseLeave={(e) => { if (i !== safePage) e.currentTarget.style.backgroundColor = "transparent" }}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="flex h-8 items-center gap-1 rounded-md px-3 font-data text-xs font-semibold transition-colors disabled:opacity-30"
              style={{ color: "var(--sentinel-text-secondary)" }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
          <span className="font-data text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
            Page {safePage + 1} of {totalPages}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Row Component ──

function CountryRow({ row, rank, exposure, onClick }: {
  row: CountryListRow; rank: number; exposure?: number; onClick: () => void
}) {
  const scorePercent = Math.min(100, Math.max(0, row.score))

  return (
    <button
      onClick={onClick}
      className="group grid w-full grid-cols-[40px_200px_1fr_100px_96px_76px_80px_44px] items-center gap-2 border-b px-4 py-2.5 text-left transition-colors"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      {/* Rank */}
      <span className="font-data text-sm tabular-nums" style={{ color: "var(--sentinel-text-tertiary)" }}>{rank}</span>

      {/* Country */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg leading-none shrink-0">{row.flag}</span>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium truncate" style={{ color: "var(--sentinel-text-primary)" }}>{row.name}</span>
            <ChevronRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--sentinel-text-tertiary)" }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>{row.code3}</span>
            {exposure != null && exposure > 0 && (
              <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>{formatMoney(exposure)} at risk</span>
            )}
          </div>
        </div>
      </div>

      {/* Assessment brief */}
      <div className="min-w-0 pr-3">
        <span className="line-clamp-2 text-xs leading-snug" style={{ color: "var(--sentinel-text-secondary)" }}>{row.brief}</span>
      </div>

      {/* Score + visual bar */}
      <div className="flex flex-col gap-1">
        <span className="font-data text-base font-bold tabular-nums" style={{ color: riskColor[row.riskLevel] }}>
          {formatScore(row.score)}
          <span className="text-[12px] font-normal" style={{ color: "var(--sentinel-text-tertiary)" }}>/100</span>
        </span>
        <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--sentinel-bg-elevated)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${scorePercent}%`, backgroundColor: riskColor[row.riskLevel], opacity: 0.8 }} />
        </div>
      </div>

      {/* Risk badge */}
      <div>
        <span className="inline-flex items-center rounded px-2 py-0.5 font-data text-[12px] font-semibold" style={{ backgroundColor: riskMutedColor[row.riskLevel], color: riskColor[row.riskLevel] }}>
          {row.riskLevel}
        </span>
      </div>

      {/* 24h Delta */}
      <span
        className="font-data text-sm font-semibold tabular-nums"
        style={{ color: row.trendDelta > 0 ? "var(--risk-critical)" : row.trendDelta < 0 ? "var(--risk-low)" : "var(--sentinel-text-tertiary)" }}
      >
        {row.trendDelta > 0 ? "+" : ""}{row.trendDelta.toFixed(1)}
      </span>

      {/* Trend */}
      <span className="font-data text-xs font-semibold" style={{ color: trendColor[row.trend] }}>
        {trendIcon[row.trend]}{" "}
        {row.trend === "DE-ESCALATING" ? "DE-ESC" : row.trend.slice(0, 5)}
      </span>

      {/* Anomaly */}
      <div className="flex items-center justify-center">
        {row.isAnomaly ? (
          <span className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: "var(--risk-critical)" }} title="Anomaly detected" />
        ) : (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--sentinel-border)" }} />
        )}
      </div>
    </button>
  )
}

// ── Header helpers ──

function HeaderLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-data text-[12px] font-bold tracking-wider ${className}`} style={{ color: "var(--sentinel-text-tertiary)" }}>
      {children}
    </span>
  )
}

function SortableHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir; onSort: (key: SortKey) => void
}) {
  const isActive = currentSort === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-data text-[12px] font-bold tracking-wider"
      style={{ color: isActive ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)" }}
    >
      {label}
      <ArrowUpDown size={10} style={{ opacity: isActive ? 1 : 0.4 }} />
      {isActive && <span className="text-[10px]">{currentDir === "desc" ? "▼" : "▲"}</span>}
    </button>
  )
}
