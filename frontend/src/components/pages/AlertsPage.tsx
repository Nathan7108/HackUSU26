import { useState } from "react"
import { alerts } from "@/data"
import { riskColor, riskMutedColor, timeAgo } from "@/lib/risk"
import { AlertTriangle, TrendingUp, ArrowUpRight, Activity, Filter } from "lucide-react"
import type { Alert } from "@/types"

const alertIcons: Record<Alert["type"], typeof AlertTriangle> = {
  ANOMALY_DETECTED: Activity,
  SCORE_SPIKE: TrendingUp,
  TIER_CHANGE: ArrowUpRight,
  FORECAST_SHIFT: TrendingUp,
}

const typeLabels: Record<Alert["type"], string> = {
  ANOMALY_DETECTED: "Anomaly",
  SCORE_SPIKE: "Score Spike",
  TIER_CHANGE: "Tier Change",
  FORECAST_SHIFT: "Forecast Shift",
}

export function AlertsPage() {
  const [filterType, setFilterType] = useState<Alert["type"] | "ALL">("ALL")

  const sorted = [...alerts]
    .filter((a) => filterType === "ALL" || a.type === filterType)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--risk-critical)" }}
            />
            <h1 className="text-lg font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
              Live Alert Feed
            </h1>
          </div>
          <span className="font-data text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {alerts.length} ACTIVE ALERTS — REAL-TIME MONITORING
          </span>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <Filter size={12} style={{ color: "var(--sentinel-text-tertiary)" }} />
          {(["ALL", "ANOMALY_DETECTED", "SCORE_SPIKE", "TIER_CHANGE", "FORECAST_SHIFT"] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="rounded px-2 py-1 font-data text-[9px] font-semibold transition-colors"
                style={{
                  backgroundColor:
                    filterType === type ? "var(--sentinel-accent-muted)" : "transparent",
                  color:
                    filterType === type ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
                }}
              >
                {type === "ALL" ? "ALL" : typeLabels[type].toUpperCase()}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Alert cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {sorted.map((alert) => {
            const Icon = alertIcons[alert.type]
            return (
              <div
                key={alert.id}
                className="flex gap-3 rounded-md border p-4"
                style={{
                  backgroundColor: "var(--sentinel-bg-surface)",
                  borderColor: "var(--sentinel-border-subtle)",
                  borderLeft: `3px solid ${riskColor[alert.severity]}`,
                }}
              >
                {/* Icon */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: riskMutedColor[alert.severity],
                    color: riskColor[alert.severity],
                  }}
                >
                  <Icon size={18} />
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--sentinel-text-primary)" }}
                    >
                      {alert.title}
                    </span>
                    <span
                      className="font-data text-[10px]"
                      style={{ color: "var(--sentinel-text-tertiary)" }}
                    >
                      {timeAgo(alert.timestamp)}
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--sentinel-text-secondary)" }}
                  >
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="rounded px-1.5 py-0.5 font-data text-[8px] font-bold"
                      style={{
                        backgroundColor: riskMutedColor[alert.severity],
                        color: riskColor[alert.severity],
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-data text-[8px] font-semibold"
                      style={{
                        backgroundColor: "var(--sentinel-bg-elevated)",
                        color: "var(--sentinel-text-secondary)",
                      }}
                    >
                      {typeLabels[alert.type]}
                    </span>
                    <span className="text-xs" style={{ color: "var(--sentinel-text-secondary)" }}>
                      {alert.countryName}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
