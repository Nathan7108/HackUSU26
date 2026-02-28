import * as React from "react"
import NumberFlow, { NumberFlowGroup } from "@number-flow/react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"
import { trendIcon, trendColor } from "@/lib/risk"
import type { KPI } from "@/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// ── Chart data per KPI (90 days, daily) ──────────────────────────

function generateDailyData(
  seed: number[],
  min: number,
  max: number,
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = []
  const start = new Date("2025-12-01")

  for (let i = 0; i < 90; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)

    const seedIdx = (i / 89) * (seed.length - 1)
    const lo = Math.floor(seedIdx)
    const hi = Math.ceil(seedIdx)
    const t = seedIdx - lo
    const base = seed[lo] * (1 - t) + seed[hi] * t

    const noise = (Math.sin(i * 7.3 + seed[0]) * 0.5 + Math.sin(i * 3.1 + seed[1]) * 0.3) * (max - min) * 0.08
    const value = Math.round(Math.max(min, Math.min(max, base + noise)))

    points.push({
      date: date.toISOString().slice(0, 10),
      value,
    })
  }
  return points
}

const kpiChartData: Record<string, { date: string; value: number }[]> = {
  "Global Threat Index": generateDailyData([54, 56, 58, 55, 60, 62, 64, 63, 66, 68, 67, 70, 72], 40, 100),
  "Active Anomalies": generateDailyData([0, 1, 1, 0, 1, 2, 1, 1, 2, 1, 2, 3, 4], 0, 8),
  "CRITICAL + HIGH": generateDailyData([2, 2, 3, 3, 2, 2, 3, 3, 2, 3, 3, 3, 3], 1, 6),
  "Escalating Now": generateDailyData([1, 2, 2, 3, 3, 2, 4, 3, 3, 4, 3, 5, 6], 0, 10),
}

const kpiColors: Record<string, string> = {
  "Global Threat Index": "var(--risk-high)",
  "Active Anomalies": "var(--risk-critical)",
  "CRITICAL + HIGH": "var(--risk-high)",
  "Escalating Now": "var(--risk-elevated)",
}

// ── Components ───────────────────────────────────────────────────

interface KpiStripProps {
  kpis: KPI[]
}

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <NumberFlowGroup>
        {kpis.map((kpi) => (
          <KpiChartCard key={kpi.label} kpi={kpi} />
        ))}
      </NumberFlowGroup>
    </div>
  )
}

function KpiChartCard({ kpi }: { kpi: KPI }) {
  const chartData = kpiChartData[kpi.label] ?? []
  const color = kpiColors[kpi.label] ?? "var(--chart-1)"
  const isThreaty = kpi.label === "Global Threat Index"

  const chartConfig = {
    value: {
      label: kpi.label,
      color,
    },
  } satisfies ChartConfig

  return (
    <Card
      className="gap-0 py-0"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <CardHeader className="flex flex-col items-stretch border-b !p-0">
        <div className="flex flex-1 items-center gap-3 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <CardDescription
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {kpi.label}
            </CardDescription>
            <CardTitle className="flex items-baseline gap-1.5">
              <span
                className="font-data text-2xl font-bold leading-none tabular-nums"
                style={{
                  color: isThreaty
                    ? kpi.value >= 70
                      ? "var(--risk-high)"
                      : "var(--risk-elevated)"
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
            </CardTitle>
          </div>
          <span
            className="ml-auto flex items-center gap-0.5 font-data text-xs font-semibold tabular-nums"
            style={{ color: trendColor[kpi.trend] }}
          >
            {trendIcon[kpi.trend]}
            {kpi.trendDelta > 0 ? "+" : ""}
            {kpi.trendDelta}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-2 pb-2">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[60px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 8, right: 8, top: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              minTickGap={48}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                />
              }
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
