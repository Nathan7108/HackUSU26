import { useQueries } from "@tanstack/react-query"
import { useDashboard } from "@/hooks/use-dashboard"
import { fetchForecast, type BackendForecast } from "@/lib/api"
import { toAlpha2, flagFromAlpha2 } from "@/lib/country-codes"
import { riskColor, riskMutedColor, trendColor, trendIcon, formatScore } from "@/lib/risk"
import type { RiskLevel, Trend, ForecastPoint } from "@/types"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts"
import { Loader2, TrendingUp, TrendingDown, Minus, Brain, Activity, ArrowUpDown } from "lucide-react"
import { useState } from "react"

// ── Types ───────────────────────────────────────────────────────

interface CountryForecast {
  code3: string
  code2: string
  name: string
  flag: string
  currentScore: number
  riskLevel: RiskLevel
  scoreDelta: number
  forecast30: number
  forecast60: number
  forecast90: number
  trend: Trend
  forecastPoints: ForecastPoint[]
  delta90: number
}

// ── Transform ───────────────────────────────────────────────────

function toRiskLevel(s: string): RiskLevel {
  const u = s.toUpperCase()
  if (u === "CRITICAL" || u === "HIGH" || u === "ELEVATED" || u === "MODERATE" || u === "LOW") return u as RiskLevel
  return "MODERATE"
}

function toTrend(s: string): Trend {
  const u = s.toUpperCase()
  if (u === "ESCALATING" || u === "STABLE" || u === "DE-ESCALATING") return u as Trend
  return "STABLE"
}

function buildForecastPoints(current: number, f: BackendForecast): ForecastPoint[] {
  return [
    { day: 0, score: current },
    { day: 15, score: Math.round((current + f.forecast_30d) / 2) },
    { day: 30, score: f.forecast_30d },
    { day: 45, score: Math.round((f.forecast_30d + f.forecast_60d) / 2) },
    { day: 60, score: f.forecast_60d },
    { day: 75, score: Math.round((f.forecast_60d + f.forecast_90d) / 2) },
    { day: 90, score: f.forecast_90d },
  ]
}

// ── Sort ────────────────────────────────────────────────────────

type SortKey = "score" | "delta90" | "forecast90" | "name"
type SortDir = "asc" | "desc"

function sortForecasts(data: CountryForecast[], key: SortKey, dir: SortDir): CountryForecast[] {
  return [...data].sort((a, b) => {
    let cmp = 0
    if (key === "name") cmp = a.name.localeCompare(b.name)
    else if (key === "score") cmp = a.currentScore - b.currentScore
    else if (key === "delta90") cmp = a.delta90 - b.delta90
    else if (key === "forecast90") cmp = a.forecast90 - b.forecast90
    return dir === "desc" ? -cmp : cmp
  })
}

// ── Component ───────────────────────────────────────────────────

export function ForecastsPage() {
  const { dashboard, isLoading: dashLoading } = useDashboard()
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const countries = dashboard?.countries ?? []

  // Fetch forecasts for all countries in parallel
  const forecastQueries = useQueries({
    queries: countries.map((c) => {
      const code2 = toAlpha2(c.code)
      return {
        queryKey: ["forecast", code2],
        queryFn: () => fetchForecast(c.name, code2),
        staleTime: 1000 * 60 * 15,
        retry: 1,
      }
    }),
  })

  const allLoaded = forecastQueries.every((q) => q.isSuccess)
  const anyLoading = dashLoading || forecastQueries.some((q) => q.isLoading)

  // Build combined data
  const forecastData: CountryForecast[] = countries
    .map((c, i) => {
      const q = forecastQueries[i]
      if (!q?.data) return null
      const f = q.data
      const code2 = toAlpha2(c.code)
      return {
        code3: c.code,
        code2,
        name: c.name,
        flag: flagFromAlpha2(code2),
        currentScore: c.score,
        riskLevel: c.riskLevel,
        scoreDelta: c.trendDelta,
        forecast30: f.forecast_30d,
        forecast60: f.forecast_60d,
        forecast90: f.forecast_90d,
        trend: toTrend(f.trend),
        forecastPoints: buildForecastPoints(c.score, f),
        delta90: Math.round(f.forecast_90d - c.score),
      } satisfies CountryForecast
    })
    .filter((x): x is CountryForecast => x !== null)

  const sorted = sortForecasts(forecastData, sortKey, sortDir)

  // Stats derived from live data
  const escalatingCount = forecastData.filter((f) => f.trend === "ESCALATING").length
  const deescalatingCount = forecastData.filter((f) => f.trend === "DE-ESCALATING").length
  const avgDelta = forecastData.length > 0
    ? Math.round(forecastData.reduce((s, f) => s + f.delta90, 0) / forecastData.length * 10) / 10
    : 0
  const highestProjected = forecastData.length > 0
    ? forecastData.reduce((max, f) => f.forecast90 > max.forecast90 ? f : max, forecastData[0])
    : null

  // Spotlight: top 3 by current score
  const spotlight = [...forecastData].sort((a, b) => b.currentScore - a.currentScore).slice(0, 3)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  // ── Loading state ──

  if (dashLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span className="font-data text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>
            Loading forecast models...
          </span>
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>
          Backend unavailable — cannot load forecasts.
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 gap-4">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
            LSTM Forecasts
          </h1>
          <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            90-DAY PROJECTIONS — 2-LAYER LSTM WITH ATTENTION — {forecastData.length} COUNTRIES
          </span>
        </div>
        {anyLoading && !allLoaded && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--sentinel-accent)" }} />
            <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              Computing forecasts...
            </span>
          </div>
        )}
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Escalating"
          value={escalatingCount}
          icon={TrendingUp}
          color="var(--risk-critical)"
        />
        <StatCard
          label="De-escalating"
          value={deescalatingCount}
          icon={TrendingDown}
          color="var(--risk-low)"
        />
        <StatCard
          label="Avg 90d Delta"
          value={avgDelta > 0 ? `+${avgDelta}` : String(avgDelta)}
          icon={Activity}
          color={avgDelta > 0 ? "var(--risk-high)" : avgDelta < 0 ? "var(--risk-low)" : "var(--sentinel-text-secondary)"}
        />
        <StatCard
          label="Highest Projected"
          value={highestProjected ? `${highestProjected.name} (${highestProjected.forecast90})` : "—"}
          icon={Brain}
          color="var(--sentinel-accent)"
        />
      </div>

      {/* ── Spotlight: Top 3 ── */}
      {spotlight.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-data text-[12px] font-bold tracking-widest" style={{ color: "var(--sentinel-text-tertiary)" }}>
              HIGHEST RISK PROJECTIONS
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {spotlight.map((cf) => (
              <SpotlightCard key={cf.code3} data={cf} />
            ))}
          </div>
        </div>
      )}

      {/* ── Full Forecast Table ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-data text-[12px] font-bold tracking-widest" style={{ color: "var(--sentinel-text-tertiary)" }}>
            ALL COUNTRY FORECASTS
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />
          <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {forecastData.length} countries
          </span>
        </div>

        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}
        >
          {/* Table header */}
          <div
            className="grid items-center gap-3 px-4 py-2.5"
            style={{
              gridTemplateColumns: "minmax(160px,1fr) 100px 80px 80px 80px 80px 140px",
              borderBottom: "1px solid var(--sentinel-border-subtle)",
            }}
          >
            <SortHeader label="Country" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <SortHeader label="Current" sortKey="score" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <span className="font-data text-[12px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>30d</span>
            <span className="font-data text-[12px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>60d</span>
            <SortHeader label="90d" sortKey="forecast90" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <SortHeader label="Delta" sortKey="delta90" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <span className="font-data text-[12px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>Trajectory</span>
          </div>

          {/* Table rows */}
          {sorted.map((cf) => (
            <ForecastRow key={cf.code3} data={cf} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: string | number
  icon: typeof TrendingUp
  color: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
      style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: "var(--sentinel-bg-elevated)" }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-data text-base font-bold tabular-nums truncate" style={{ color }}>
          {value}
        </span>
        <span className="text-[12px] truncate" style={{ color: "var(--sentinel-text-tertiary)" }}>
          {label}
        </span>
      </div>
    </div>
  )
}

function SpotlightCard({ data }: { data: CountryForecast }) {
  const TrendIcon = data.trend === "ESCALATING" ? TrendingUp : data.trend === "DE-ESCALATING" ? TrendingDown : Minus

  return (
    <div
      className="flex flex-col rounded-lg border overflow-hidden"
      style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--sentinel-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{data.flag}</span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
              {data.name}
            </span>
            <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {data.code3}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-data text-xl font-bold tabular-nums" style={{ color: riskColor[data.riskLevel] }}>
            {formatScore(data.currentScore)}
          </span>
          <span
            className="rounded px-1.5 py-px font-data text-[11px] font-semibold"
            style={{ backgroundColor: riskMutedColor[data.riskLevel], color: riskColor[data.riskLevel] }}
          >
            {data.riskLevel}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-32 px-3 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.forecastPoints}>
            <defs>
              <linearGradient id={`spot-${data.code3}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={riskColor[data.riskLevel]} stopOpacity={0.25} />
                <stop offset="100%" stopColor={riskColor[data.riskLevel]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "var(--sentinel-text-tertiary)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(d: number) => `${d}d`}
            />
            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
            <ReferenceLine y={data.currentScore} stroke="var(--sentinel-border)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--sentinel-bg-elevated)",
                border: "1px solid var(--sentinel-border)",
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(d: number) => `Day ${d}`}
              formatter={(v: number) => [formatScore(v), "Score"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke={riskColor[data.riskLevel]}
              fill={`url(#spot-${data.code3})`}
              strokeWidth={2}
              dot={{ r: 3, fill: riskColor[data.riskLevel], stroke: "var(--sentinel-bg-surface)", strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast summary row */}
      <div
        className="grid grid-cols-3 gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}
      >
        <ForecastMini label="30d" value={data.forecast30} current={data.currentScore} riskLevel={data.riskLevel} />
        <ForecastMini label="60d" value={data.forecast60} current={data.currentScore} riskLevel={data.riskLevel} />
        <ForecastMini label="90d" value={data.forecast90} current={data.currentScore} riskLevel={data.riskLevel} />
      </div>

      {/* Trend footer */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: "var(--sentinel-bg-elevated)" }}
      >
        <div className="flex items-center gap-1.5">
          <TrendIcon size={14} style={{ color: trendColor[data.trend] }} />
          <span className="font-data text-[12px] font-semibold" style={{ color: trendColor[data.trend] }}>
            {data.trend}
          </span>
        </div>
        <span className="font-data text-[12px] font-bold tabular-nums" style={{ color: trendColor[data.trend] }}>
          {data.delta90 > 0 ? "+" : ""}{data.delta90} pts
        </span>
      </div>
    </div>
  )
}

function ForecastMini({ label, value, current, riskLevel }: {
  label: string
  value: number
  current: number
  riskLevel: RiskLevel
}) {
  const delta = Math.round(value - current)
  return (
    <div className="flex flex-col items-center">
      <span className="font-data text-[11px] tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {label}
      </span>
      <span className="font-data text-sm font-bold tabular-nums" style={{ color: riskColor[riskLevel] }}>
        {formatScore(value)}
      </span>
      <span
        className="font-data text-[11px] tabular-nums"
        style={{ color: delta > 0 ? "var(--risk-critical)" : delta < 0 ? "var(--risk-low)" : "var(--sentinel-text-tertiary)" }}
      >
        {delta > 0 ? "+" : ""}{delta}
      </span>
    </div>
  )
}

function ForecastRow({ data }: { data: CountryForecast }) {
  const delta = data.delta90

  return (
    <div
      className="grid items-center gap-3 px-4 py-2 transition-colors"
      style={{
        gridTemplateColumns: "minmax(160px,1fr) 100px 80px 80px 80px 80px 140px",
        borderBottom: "1px solid var(--sentinel-border-subtle)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      {/* Country */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{data.flag}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate" style={{ color: "var(--sentinel-text-primary)" }}>
            {data.name}
          </span>
          <span className="font-data text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {data.code3}
          </span>
        </div>
      </div>

      {/* Current score + badge */}
      <div className="flex items-center gap-2">
        <span className="font-data text-sm font-bold tabular-nums" style={{ color: riskColor[data.riskLevel] }}>
          {formatScore(data.currentScore)}
        </span>
        <span
          className="rounded px-1.5 py-px font-data text-[10px] font-semibold"
          style={{ backgroundColor: riskMutedColor[data.riskLevel], color: riskColor[data.riskLevel] }}
        >
          {data.riskLevel}
        </span>
      </div>

      {/* 30d */}
      <span className="font-data text-sm tabular-nums" style={{ color: "var(--sentinel-text-primary)" }}>
        {formatScore(data.forecast30)}
      </span>

      {/* 60d */}
      <span className="font-data text-sm tabular-nums" style={{ color: "var(--sentinel-text-primary)" }}>
        {formatScore(data.forecast60)}
      </span>

      {/* 90d */}
      <span className="font-data text-sm font-bold tabular-nums" style={{ color: "var(--sentinel-text-primary)" }}>
        {formatScore(data.forecast90)}
      </span>

      {/* Delta */}
      <div className="flex items-center gap-1">
        <span style={{ color: trendColor[data.trend], fontSize: 12 }}>
          {trendIcon[data.trend]}
        </span>
        <span
          className="font-data text-sm font-semibold tabular-nums"
          style={{ color: delta > 0 ? "var(--risk-critical)" : delta < 0 ? "var(--risk-low)" : "var(--sentinel-text-tertiary)" }}
        >
          {delta > 0 ? "+" : ""}{delta}
        </span>
      </div>

      {/* Sparkline */}
      <div className="h-8">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.forecastPoints}>
            <defs>
              <linearGradient id={`row-${data.code3}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={riskColor[data.riskLevel]} stopOpacity={0.2} />
                <stop offset="100%" stopColor={riskColor[data.riskLevel]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin - 3", "dataMax + 3"]} />
            <Area
              type="monotone"
              dataKey="score"
              stroke={riskColor[data.riskLevel]}
              fill={`url(#row-${data.code3})`}
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const isActive = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-data text-[12px] font-bold tracking-wider"
      style={{ color: isActive ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)" }}
    >
      {label}
      <ArrowUpDown size={10} style={{ opacity: isActive ? 1 : 0.4 }} />
      {isActive && <span className="text-[10px]">{dir === "desc" ? "▼" : "▲"}</span>}
    </button>
  )
}
