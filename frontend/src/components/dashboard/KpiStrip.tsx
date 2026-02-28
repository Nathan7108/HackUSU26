import { useMemo } from "react"
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
  const chartData = kpi.chartData ?? []
  const color = kpi.chartColor ?? "var(--chart-1)"

  const chartConfig = useMemo(
    () =>
      ({
        value: {
          label: kpi.label,
          color,
        },
      }) satisfies ChartConfig,
    [kpi.label, color],
  )

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
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {kpi.label}
            </CardDescription>
            <CardTitle className="flex items-baseline gap-1.5">
              <span
                className="font-data text-2xl font-bold leading-none tabular-nums"
                style={{ color }}
              >
                <NumberFlow value={kpi.value} trend={1} />
              </span>
              {kpi.unit && (
                <span
                  className="text-[11px]"
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
            <XAxis dataKey="date" hide />
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
        {chartData.length >= 2 && (
          <div
            className="flex items-center justify-between px-1.5 pt-1"
          >
            <span
              className="font-data text-[10px] tabular-nums"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {formatShortDate(chartData[0].date)}
            </span>
            <span
              className="font-data text-[10px] tabular-nums"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {formatShortDate(chartData[chartData.length - 1].date)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
