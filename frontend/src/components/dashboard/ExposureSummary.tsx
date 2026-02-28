import { riskColor, formatMoney } from "@/lib/risk"
import { useExposure } from "@/hooks/use-dashboard"
import { flagFromAlpha2 } from "@/lib/country-codes"
import { ShieldAlert, Route, Factory } from "lucide-react"
import type { RiskLevel } from "@/types"

export function ExposureSummary() {
  const { data: exposure } = useExposure()

  if (!exposure) return null

  const entries = Object.values(exposure.countryExposure)
    .filter((e) => e.totalExposure > 0)
    .sort((a, b) => b.totalExposure - a.totalExposure)

  const totalExposure = exposure.totalExposure
  const maxExposure = Math.max(...entries.map((e) => e.totalExposure), 1)
  const highRiskRoutes = exposure.routes.filter(
    (r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL",
  )

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
          Cascade Exposure
        </span>
        <span
          className="font-data text-xs font-bold"
          style={{ color: "var(--risk-high)" }}
        >
          {formatMoney(totalExposure)}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }}>
        <StatCell
          icon={ShieldAlert}
          label="At Risk"
          value={formatMoney(totalExposure)}
          color="var(--risk-high)"
        />
        <StatCell
          icon={Factory}
          label="Facilities"
          value={`${exposure.facilities.filter((f) => f.annualValue > 0).length}/${exposure.facilities.length}`}
          color="var(--risk-elevated)"
        />
        <StatCell
          icon={Route}
          label="High-Risk Routes"
          value={`${highRiskRoutes.length}`}
          color="var(--risk-critical)"
        />
      </div>

      {/* Top exposure items */}
      <div className="flex flex-col">
        {entries.slice(0, 4).map((entry) => (
          <div
            key={entry.countryCode}
            className="flex items-center gap-2 border-t px-3 py-1.5"
            style={{ borderColor: "var(--sentinel-border-subtle)" }}
          >
            <span className="text-xs">{flagFromAlpha2(entry.countryCode)}</span>
            <span
              className="flex-1 text-[12px] truncate"
              style={{ color: "var(--sentinel-text-secondary)" }}
            >
              {entry.countryName}
            </span>
            <span
              className="font-data text-[12px] font-semibold"
              style={{ color: riskColor[entry.riskLevel as RiskLevel] ?? "var(--sentinel-text-primary)" }}
            >
              {formatMoney(entry.totalExposure)}
            </span>
            {/* Exposure bar */}
            <div
              className="h-1.5 w-16 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (entry.totalExposure / maxExposure) * 100)}%`,
                  backgroundColor: riskColor[entry.riskLevel as RiskLevel] ?? "var(--risk-moderate)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCell({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ShieldAlert
  label: string
  value: string
  color: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 py-2.5"
      style={{ backgroundColor: "var(--sentinel-bg-surface)" }}
    >
      <Icon size={14} style={{ color }} />
      <span className="font-data text-sm font-bold" style={{ color }}>
        {value}
      </span>
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {label}
      </span>
    </div>
  )
}
