import type { Country } from "@/types"
import { riskColor, riskMutedColor, formatMoney } from "@/lib/risk"
import { facilities, tradeRoutes } from "@/data"
import { ShieldAlert, Route, Factory } from "lucide-react"

interface ExposureSummaryProps {
  countries: Country[]
}

export function ExposureSummary({ countries }: ExposureSummaryProps) {
  const totalExposure = countries.reduce(
    (sum, c) => sum + (c.exposure?.totalExposure ?? 0),
    0,
  )

  const affectedFacilityIds = new Set(
    countries.flatMap((c) => c.exposure?.affectedFacilities ?? []),
  )

  const affectedRouteIds = new Set(
    countries.flatMap((c) => c.exposure?.affectedRoutes ?? []),
  )

  const highRiskRoutes = tradeRoutes.filter(
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
          className="text-[10px] font-semibold uppercase tracking-wider"
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
          value={`${affectedFacilityIds.size}/${facilities.length}`}
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
        {countries
          .filter((c) => c.exposure && c.exposure.totalExposure > 0)
          .sort((a, b) => (b.exposure?.totalExposure ?? 0) - (a.exposure?.totalExposure ?? 0))
          .slice(0, 4)
          .map((country) => (
            <div
              key={country.code}
              className="flex items-center gap-2 border-t px-3 py-1.5"
              style={{ borderColor: "var(--sentinel-border-subtle)" }}
            >
              <span className="text-xs">{country.flag}</span>
              <span
                className="flex-1 text-[11px] truncate"
                style={{ color: "var(--sentinel-text-secondary)" }}
              >
                {country.name}
              </span>
              <span
                className="font-data text-[11px] font-semibold"
                style={{ color: riskColor[country.riskLevel] }}
              >
                {formatMoney(country.exposure!.totalExposure)}
              </span>
              {/* Exposure bar */}
              <div
                className="h-1.5 w-16 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (country.exposure!.totalExposure / 700) * 100)}%`,
                    backgroundColor: riskColor[country.riskLevel],
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
        className="text-[9px] uppercase tracking-wider"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {label}
      </span>
    </div>
  )
}
