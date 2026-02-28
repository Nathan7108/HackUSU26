import type { Alert } from "@/types"
import { riskColor, riskMutedColor, timeAgo } from "@/lib/risk"
import { AlertTriangle, TrendingUp, ArrowUpRight, Activity } from "lucide-react"

interface AlertFeedProps {
  alerts: Alert[]
}

const alertIcons: Record<Alert["type"], typeof AlertTriangle> = {
  ANOMALY_DETECTED: Activity,
  SCORE_SPIKE: TrendingUp,
  TIER_CHANGE: ArrowUpRight,
  FORECAST_SHIFT: TrendingUp,
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  const sorted = [...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-md border"
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
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--risk-critical)" }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            Live Alerts
          </span>
        </div>
        <span
          className="font-data text-[10px]"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {alerts.length} ACTIVE
        </span>
      </div>

      {/* Alert list */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {sorted.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  )
}

function AlertRow({ alert }: { alert: Alert }) {
  const Icon = alertIcons[alert.type]

  return (
    <div
      className="flex gap-2.5 border-b px-3 py-2.5 last:border-b-0"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
    >
      {/* Icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
        style={{
          backgroundColor: riskMutedColor[alert.severity],
          color: riskColor[alert.severity],
        }}
      >
        <Icon size={14} />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-xs font-medium leading-tight truncate"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          {alert.title}
        </span>
        <span
          className="text-[10px] leading-tight line-clamp-2"
          style={{ color: "var(--sentinel-text-secondary)" }}
        >
          {alert.description}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="rounded px-1 py-px font-data text-[8px] font-semibold"
            style={{
              backgroundColor: riskMutedColor[alert.severity],
              color: riskColor[alert.severity],
            }}
          >
            {alert.severity}
          </span>
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {alert.countryName}
          </span>
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {timeAgo(alert.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}
