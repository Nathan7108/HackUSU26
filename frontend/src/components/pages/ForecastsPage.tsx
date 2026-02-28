import { countries } from "@/data"
import { riskColor, riskMutedColor, trendColor, formatScore } from "@/lib/risk"
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts"

export function ForecastsPage() {
  const withForecasts = countries
    .filter((c) => c.forecast.length > 0)
    .sort((a, b) => b.score - a.score)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {/* Header */}
      <div className="flex flex-col mb-4">
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          LSTM Forecasts
        </h1>
        <span
          className="font-data text-[10px]"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          90-DAY PROJECTIONS — 2-LAYER LSTM WITH ATTENTION — {withForecasts.length} COUNTRIES
        </span>
      </div>

      {/* Forecast cards grid */}
      <div className="grid grid-cols-3 gap-3">
        {withForecasts.map((country) => {
          const last = country.forecast[country.forecast.length - 1]
          const delta = last.score - country.score

          return (
            <div
              key={country.code}
              className="flex flex-col rounded-md border"
              style={{
                backgroundColor: "var(--sentinel-bg-surface)",
                borderColor: "var(--sentinel-border-subtle)",
              }}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between border-b px-3 py-2"
                style={{ borderColor: "var(--sentinel-border-subtle)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{country.flag}</span>
                  <div className="flex flex-col">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--sentinel-text-primary)" }}
                    >
                      {country.name}
                    </span>
                    <span
                      className="font-data text-[9px]"
                      style={{ color: "var(--sentinel-text-tertiary)" }}
                    >
                      {country.code}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className="font-data text-lg font-bold"
                    style={{ color: riskColor[country.riskLevel] }}
                  >
                    {formatScore(country.score)}
                  </span>
                  <span
                    className="rounded px-1 py-px font-data text-[8px] font-semibold"
                    style={{
                      backgroundColor: riskMutedColor[country.riskLevel],
                      color: riskColor[country.riskLevel],
                    }}
                  >
                    {country.riskLevel}
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-24 px-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={country.forecast}>
                    <defs>
                      <linearGradient id={`fg-${country.code}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={riskColor[country.riskLevel]} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={riskColor[country.riskLevel]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 8, fill: "var(--sentinel-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d) => `${d}d`}
                    />
                    <YAxis hide domain={["dataMin - 3", "dataMax + 3"]} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke={riskColor[country.riskLevel]}
                      fill={`url(#fg-${country.code})`}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Forecast summary */}
              <div className="flex items-center justify-between px-3 py-2">
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  90d projection
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-data text-xs font-bold"
                    style={{ color: riskColor[country.riskLevel] }}
                  >
                    {formatScore(last.score)}
                  </span>
                  <span
                    className="font-data text-[10px] font-semibold"
                    style={{ color: delta > 0 ? trendColor.ESCALATING : delta < 0 ? trendColor["DE-ESCALATING"] : trendColor.STABLE }}
                  >
                    {delta > 0 ? "+" : ""}{delta.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
