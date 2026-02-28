import { NumberFlowGroup } from "@number-flow/react"
import NumberFlow from "@number-flow/react"
import { riskColor, trendIcon, trendColor } from "@/lib/risk"
import type { KPI } from "@/types"

interface KpiStripProps {
  kpis: KPI[]
}

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <div className="flex gap-2 px-4 pt-3 pb-2">
      <NumberFlowGroup>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </NumberFlowGroup>
    </div>
  )
}

function KpiCard({ kpi }: { kpi: KPI }) {
  const isThreaty = kpi.label === "Global Threat Index"

  return (
    <div
      className="flex flex-1 flex-col gap-1.5 rounded-md border px-3 py-2.5"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      {/* Label */}
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {kpi.label}
      </span>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <span
          className="font-data text-2xl font-bold leading-none"
          style={{
            color: isThreaty
              ? kpi.value >= 70
                ? riskColor.HIGH
                : riskColor.ELEVATED
              : "var(--sentinel-text-primary)",
          }}
        >
          <NumberFlow value={kpi.value} trend={1} />
        </span>
        {kpi.unit && (
          <span
            className="text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {kpi.unit}
          </span>
        )}

        {/* Trend badge */}
        <span
          className="ml-auto flex items-center gap-0.5 font-data text-[11px] font-semibold"
          style={{ color: trendColor[kpi.trend] }}
        >
          {trendIcon[kpi.trend]}
          {kpi.trendDelta > 0 ? "+" : ""}
          {kpi.trendDelta}
        </span>
      </div>

      {/* Sparkline */}
      {kpi.sparkline && <Sparkline data={kpi.sparkline} trend={kpi.trend} />}
    </div>
  )
}

function Sparkline({ data, trend }: { data: number[]; trend: KPI["trend"] }) {
  const width = 100
  const height = 20
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-4 w-full">
      <polyline
        points={points}
        fill="none"
        stroke={trendColor[trend]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
