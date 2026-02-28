import { countries, facilities, tradeRoutes } from "@/data"
import { riskColor, riskMutedColor, formatMoney } from "@/lib/risk"
import { Factory, Route, ShieldAlert, MapPin } from "lucide-react"
import type { Facility, TradeRoute } from "@/types"

export function ExposurePage() {
  const totalExposure = countries.reduce(
    (sum, c) => sum + (c.exposure?.totalExposure ?? 0),
    0,
  )

  const totalAnnualValue = facilities.reduce((sum, f) => sum + f.annualValue, 0)
  const highRiskRoutes = tradeRoutes.filter(
    (r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL",
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <h1
            className="text-lg font-semibold"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            Supply Chain Exposure
          </h1>
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            CASCADE PRECISION INDUSTRIES — GLOBAL OPERATIONS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Stat label="Total At Risk" value={formatMoney(totalExposure)} color="var(--risk-high)" />
          <Stat label="Annual Revenue" value={formatMoney(totalAnnualValue)} color="var(--sentinel-accent)" />
          <Stat label="Facilities" value={String(facilities.length)} color="var(--sentinel-text-primary)" />
          <Stat label="Trade Routes" value={String(tradeRoutes.length)} color="var(--sentinel-text-primary)" />
        </div>
      </div>

      {/* Facilities grid */}
      <SectionHeader title="FACILITIES" icon={Factory} count={facilities.length} />
      <div className="grid grid-cols-4 gap-2 mb-4">
        {facilities.map((facility) => (
          <FacilityCard key={facility.id} facility={facility} />
        ))}
      </div>

      {/* Trade routes */}
      <SectionHeader title="TRADE ROUTES" icon={Route} count={tradeRoutes.length} />
      <div className="flex flex-col gap-1 mb-4">
        {tradeRoutes.map((route) => (
          <RouteRow key={route.id} route={route} />
        ))}
      </div>

      {/* Country exposure breakdown */}
      <SectionHeader title="COUNTRY EXPOSURE" icon={ShieldAlert} count={countries.filter((c) => c.exposure).length} />
      <div className="grid grid-cols-2 gap-2 mb-4">
        {countries
          .filter((c) => c.exposure && c.exposure.totalExposure > 0)
          .sort((a, b) => (b.exposure?.totalExposure ?? 0) - (a.exposure?.totalExposure ?? 0))
          .map((country) => (
            <div
              key={country.code}
              className="flex flex-col gap-2 rounded-md border p-3"
              style={{
                backgroundColor: "var(--sentinel-bg-surface)",
                borderColor: "var(--sentinel-border-subtle)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{country.flag}</span>
                  <span className="text-xs font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
                    {country.name}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 font-data text-[8px] font-semibold"
                    style={{
                      backgroundColor: riskMutedColor[country.riskLevel],
                      color: riskColor[country.riskLevel],
                    }}
                  >
                    {country.riskLevel}
                  </span>
                </div>
                <span
                  className="font-data text-sm font-bold"
                  style={{ color: riskColor[country.riskLevel] }}
                >
                  {formatMoney(country.exposure!.totalExposure)}
                </span>
              </div>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: "var(--sentinel-text-secondary)" }}
              >
                {country.exposure!.description}
              </p>
            </div>
          ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="flex flex-col items-center rounded-md border px-4 py-2"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <span className="font-data text-lg font-bold" style={{ color }}>
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

function SectionHeader({
  title,
  icon: Icon,
  count,
}: {
  title: string
  icon: typeof Factory
  count: number
}) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-2">
      <Icon size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
      <span
        className="font-data text-[10px] font-bold tracking-widest"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {title}
      </span>
      <span
        className="font-data text-[10px]"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        ({count})
      </span>
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: "var(--sentinel-border-subtle)" }}
      />
    </div>
  )
}

function FacilityCard({ facility }: { facility: Facility }) {
  const typeColors: Record<string, string> = {
    hq: "#3b82f6",
    manufacturing: "#22c55e",
    processing: "#eab308",
    assembly: "#a855f7",
    distribution: "#64748b",
  }

  return (
    <div
      className="flex flex-col gap-1.5 rounded-md border p-3"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
          {facility.name}
        </span>
        <span
          className="rounded px-1.5 py-0.5 font-data text-[8px] font-bold uppercase"
          style={{
            backgroundColor: `${typeColors[facility.type]}20`,
            color: typeColors[facility.type],
          }}
        >
          {facility.type}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <MapPin size={10} style={{ color: "var(--sentinel-text-tertiary)" }} />
        <span className="text-[10px]" style={{ color: "var(--sentinel-text-secondary)" }}>
          {facility.location}
        </span>
      </div>
      <span className="text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {facility.function}
      </span>
      {facility.annualValue > 0 && (
        <span
          className="font-data text-xs font-bold"
          style={{ color: typeColors[facility.type] }}
        >
          {formatMoney(facility.annualValue)}/yr
        </span>
      )}
    </div>
  )
}

function RouteRow({ route }: { route: TradeRoute }) {
  return (
    <div
      className="grid grid-cols-[1fr_30px_1fr_1fr_100px_80px] items-center gap-2 rounded-md border px-3 py-2"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <span className="text-[11px] font-medium" style={{ color: "var(--sentinel-text-primary)" }}>
        {route.from.name} <span style={{ color: "var(--sentinel-text-tertiary)" }}>({route.from.location})</span>
      </span>
      <span className="text-center" style={{ color: "var(--sentinel-text-tertiary)" }}>→</span>
      <span className="text-[11px] font-medium" style={{ color: "var(--sentinel-text-primary)" }}>
        {route.to.name} <span style={{ color: "var(--sentinel-text-tertiary)" }}>({route.to.location})</span>
      </span>
      <span className="text-[10px]" style={{ color: "var(--sentinel-text-secondary)" }}>
        {route.chokepoint}
      </span>
      <span
        className="inline-flex w-fit rounded px-1.5 py-0.5 font-data text-[9px] font-semibold"
        style={{
          backgroundColor: riskMutedColor[route.riskLevel],
          color: riskColor[route.riskLevel],
        }}
      >
        {route.riskLevel}
      </span>
      <span className="font-data text-[11px] font-bold text-right" style={{ color: "var(--sentinel-text-primary)" }}>
        {formatMoney(route.annualCargo)}
      </span>
    </div>
  )
}
