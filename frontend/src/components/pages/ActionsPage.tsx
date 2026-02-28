import { useMemo, useState } from "react"
import { motion } from "motion/react"
import NumberFlow from "@number-flow/react"
import {
  ShieldCheck,
  Target,
  Zap,
  Clock,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Anchor,
  Atom,
  Pickaxe,
  Cpu,
  Crosshair,
  FileText,
  Globe,
  Loader2,
  MapPin,
} from "lucide-react"
import { useRouter } from "@tanstack/react-router"
import { useRecommendations, useExposure } from "@/hooks/use-dashboard"
import { useAppStore } from "@/stores/app"
import { flagFromAlpha2 } from "@/lib/country-codes"
import { riskColor, formatMoney } from "@/lib/risk"
import type { RiskLevel } from "@/types"
import type { BackendRecommendation } from "@/lib/api"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ── Constants ────────────────────────────────────────────────────

const priorityColor: Record<string, string> = {
  IMMEDIATE: "var(--risk-critical)",
  SHORT_TERM: "var(--risk-elevated)",
  MEDIUM_TERM: "var(--risk-moderate)",
}

const priorityLabel: Record<string, string> = {
  IMMEDIATE: "IMMEDIATE",
  SHORT_TERM: "SHORT TERM",
  MEDIUM_TERM: "MEDIUM TERM",
}

const priorityOrder: Record<string, number> = {
  IMMEDIATE: 0,
  SHORT_TERM: 1,
  MEDIUM_TERM: 2,
}

const riskSeverity: Record<RiskLevel, number> = { CRITICAL: 4, HIGH: 3, ELEVATED: 2, MODERATE: 1, LOW: 0 }

// Hotspot groupings — story-level domain knowledge
const hotspotDefs: { name: string; icon: typeof Target; countryCodes: string[]; description: string }[] = [
  { name: "Taiwan Strait", icon: Cpu, countryCodes: ["TW", "JP"], description: "Semiconductor supply chain & assembly" },
  { name: "China Rare Earth", icon: Pickaxe, countryCodes: ["CN"], description: "Yttrium & scandium minerals" },
  { name: "Red Sea / Suez", icon: Anchor, countryCodes: ["YE", "IR", "IL", "SG", "NL"], description: "Shipping corridor — Singapore→Rotterdam" },
  { name: "Russia Titanium", icon: Atom, countryCodes: ["RU", "UA", "IT"], description: "Titanium supply chain & forging" },
]

// ── Main Component ───────────────────────────────────────────────

export function ActionsPage() {
  const [filter, setFilter] = useState<"ALL" | "IMMEDIATE" | "SHORT_TERM" | "MEDIUM_TERM">("ALL")
  const [selected, setSelected] = useState<BackendRecommendation | null>(null)

  const { data: recsData, isLoading: recsLoading } = useRecommendations()
  const { data: exposureData } = useExposure()
  const allRecs = recsData?.recommendations ?? []

  // Filter and sort
  const filteredRecs = useMemo(() => {
    const filtered = filter === "ALL" ? allRecs : allRecs.filter((r) => r.priority === filter)
    return [...filtered].sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      return b.roi - a.roi
    })
  }, [allRecs, filter])

  // Aggregate KPIs from live data
  const kpis = useMemo(() => {
    const totalExposure = exposureData?.totalExposure ?? allRecs.reduce((sum, r) => sum + r.exposure, 0)
    const totalCost = allRecs.reduce((sum, r) => sum + r.cost, 0)
    const totalProtected = allRecs.reduce((sum, r) => sum + r.riskReduction, 0)
    const portfolioRoi = totalCost > 0 ? Math.round(totalProtected / totalCost) : 0
    return { totalExposure, totalCost, totalProtected, portfolioRoi, count: allRecs.length }
  }, [allRecs, exposureData])

  // Hotspot computed data from live exposure + recommendations
  const hotspotData = useMemo(() => {
    return hotspotDefs.map((def) => {
      // Get exposure from live data
      const countryExposure = exposureData?.countryExposure ?? {}
      const hExposures = def.countryCodes
        .map((code) => countryExposure[code])
        .filter(Boolean)

      const exposure = Math.max(...hExposures.map((e) => e.totalExposure), 0)
      const worstRisk = hExposures.reduce<RiskLevel>(
        (worst, e) => {
          const level = (e.riskLevel ?? "MODERATE") as RiskLevel
          return riskSeverity[level] > riskSeverity[worst] ? level : worst
        },
        "LOW",
      )

      // Get recommendations for these countries
      const hRecs = allRecs.filter((r) => def.countryCodes.includes(r.countryCode))
      const totalCost = hRecs.reduce((sum, r) => sum + r.cost, 0)
      const totalReduction = hRecs.reduce((sum, r) => sum + r.riskReduction, 0)
      const coverage = exposure > 0 ? Math.min(100, (totalReduction / exposure) * 100) : 0

      return { ...def, exposure, riskLevel: worstRisk, actionCount: hRecs.length, totalCost, totalReduction, coverage }
    })
  }, [allRecs, exposureData])

  // Priority counts
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { IMMEDIATE: 0, SHORT_TERM: 0, MEDIUM_TERM: 0 }
    allRecs.forEach((r) => { counts[r.priority] = (counts[r.priority] ?? 0) + 1 })
    return counts
  }, [allRecs])

  if (recsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span className="font-data text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>
            Loading recommendations...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-4">
        <div className="flex flex-col">
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            Actions
          </h1>
          <span
            className="font-data text-xs"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {recsData?.company?.toUpperCase() ?? "CASCADE PRECISION INDUSTRIES"} — STRATEGIC MITIGATION PORTFOLIO
          </span>
        </div>
      </div>

      {/* Historical Losses Banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-4 mb-2 flex items-center gap-3 rounded-md border px-4 py-2.5"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          borderColor: "var(--sentinel-border-subtle)",
        }}
      >
        <Clock size={14} style={{ color: "var(--sentinel-text-tertiary)", flexShrink: 0 }} />
        <span
          className="font-data text-xs leading-snug"
          style={{ color: "var(--sentinel-text-secondary)" }}
        >
          <strong style={{ color: "var(--sentinel-text-primary)" }}>HISTORICAL:</strong>
          {" "}Russia 2022 — <strong className="font-data" style={{ color: "var(--sentinel-text-primary)" }}>$47M loss</strong>.
          {" "}Red Sea 2024 — <strong className="font-data" style={{ color: "var(--sentinel-text-primary)" }}>$23M</strong> added shipping.
          {" "}Total: <strong className="font-data" style={{ color: "var(--sentinel-text-primary)" }}>$70M in preventable losses</strong>.
        </span>
      </motion.div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-2 px-4 pb-3">
        <KpiCard label="Total Exposure" value={kpis.totalExposure} format="money" color="var(--risk-critical)" icon={AlertTriangle} />
        <KpiCard label="Mitigation Cost" value={kpis.totalCost} format="money" color="var(--sentinel-text-primary)" icon={DollarSign} />
        <KpiCard label="Value Protected" value={kpis.totalProtected} format="money" color="var(--sentinel-text-primary)" icon={ShieldCheck} />
        <KpiCard label="Portfolio ROI" value={kpis.portfolioRoi} format="roi" color="var(--sentinel-text-primary)" icon={TrendingDown} />
        <KpiCard label="Actions Pending" value={kpis.count} format="count" color="var(--sentinel-text-primary)" icon={Zap} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Threat Hotspots */}
        <SectionHeader title="THREAT HOTSPOTS" icon={Target} count={hotspotData.length} />
        <div className="grid grid-cols-4 gap-2 mb-4">
          {hotspotData.map((h, i) => (
            <HotspotCard key={h.name} hotspot={h} index={i} />
          ))}
        </div>

        {/* Prioritized Actions */}
        <div className="flex items-center gap-2 mb-2 mt-1">
          <Zap size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span
            className="font-data text-xs font-bold tracking-widest"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            PRIORITIZED ACTIONS
          </span>
          <span
            className="font-data text-xs"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            ({filteredRecs.length})
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />
          <div className="flex items-center gap-1">
            {(["ALL", "IMMEDIATE", "SHORT_TERM", "MEDIUM_TERM"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className="rounded px-2.5 py-1.5 font-data text-[12px] font-semibold tracking-wide transition-colors"
                style={{
                  backgroundColor: filter === type ? "var(--sentinel-accent-muted)" : "transparent",
                  color: filter === type ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
                }}
              >
                {type === "ALL" ? "ALL" : priorityLabel[type]}
                {type !== "ALL" && (
                  <span className="ml-1 opacity-60">({priorityCounts[type]})</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 mb-4">
          {filteredRecs.map((rec, i) => (
            <ActionRow
              key={`${rec.countryCode}-${rec.action}`}
              rec={rec}
              index={i}
              onClick={() => setSelected(rec)}
            />
          ))}
        </div>
      </div>

      {/* Action Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto" style={{ backgroundColor: "var(--sentinel-bg-base)" }}>
          {selected && <ActionDetailSheet rec={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Action Detail Sheet ─────────────────────────────────────────

function ActionDetailSheet({ rec, onClose }: { rec: BackendRecommendation; onClose: () => void }) {
  const flag = flagFromAlpha2(rec.countryCode)
  const rLevel = (rec.riskLevel ?? "MODERATE") as RiskLevel
  const { selectCountry } = useAppStore()
  const router = useRouter()

  const handleViewOnMap = () => {
    onClose()
    selectCountry(rec.countryCode)
    router.navigate({ to: "/dashboard" })
  }

  return (
    <>
      <SheetHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{flag}</span>
            <div>
              <SheetTitle
                className="text-lg font-semibold"
                style={{ color: "var(--sentinel-text-primary)" }}
              >
                {rec.countryName}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Intelligence brief for {rec.countryName}
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 pr-8">
            <button
              onClick={handleViewOnMap}
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 font-data text-[11px] font-bold tracking-wide transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--sentinel-accent-muted)",
                color: "var(--sentinel-accent)",
              }}
            >
              <MapPin size={12} />
              VIEW ON MAP
            </button>
            <span
              className="rounded px-2 py-1 font-data text-[11px] font-bold tracking-wide"
              style={{
                backgroundColor: "var(--sentinel-bg-elevated)",
                color: priorityColor[rec.priority],
              }}
            >
              {priorityLabel[rec.priority]}
            </span>
            <div className="flex flex-col items-center">
              <span
                className="font-data text-2xl font-bold tabular-nums leading-none"
                style={{ color: riskColor[rLevel] }}
              >
                {rec.riskScore}
              </span>
              <span
                className="font-data text-[10px] uppercase tracking-wider"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                risk
              </span>
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-4 pb-6">
        {/* Action Hero */}
        <div
          className="rounded-md border p-4"
          style={{
            backgroundColor: "var(--sentinel-bg-surface)",
            borderColor: "var(--sentinel-border-subtle)",
            borderLeft: `3px solid ${priorityColor[rec.priority]}`,
          }}
        >
          <span
            className="text-lg font-bold leading-snug"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            {rec.action}
          </span>
          <p
            className="text-sm leading-relaxed mt-2"
            style={{ color: "var(--sentinel-text-secondary)" }}
          >
            {rec.description}
          </p>
        </div>

        {/* Trigger */}
        <div className="flex items-start gap-2">
          <Crosshair size={14} className="mt-0.5 shrink-0" style={{ color: "var(--sentinel-text-tertiary)" }} />
          <div>
            <span
              className="font-data text-[11px] font-bold uppercase tracking-wide block mb-0.5"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              TRIGGER CONDITION
            </span>
            <span
              className="font-data text-sm"
              style={{ color: "var(--sentinel-text-secondary)" }}
            >
              {rec.trigger}
            </span>
          </div>
        </div>

        {/* Cost Analysis — 2x2 Grid */}
        <SheetSection title="COST ANALYSIS" icon={DollarSign}>
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label="Cost to Act" value={formatMoney(rec.cost)} color="var(--sentinel-text-primary)" />
            <MetricBox label="Cost of Inaction" value={formatMoney(rec.costOfInaction)} color="var(--risk-critical)" />
            <MetricBox label="ROI" value={rec.roi > 0 ? `${rec.roi}x` : "—"} color="var(--sentinel-text-primary)" />
            <MetricBox label="Value Protected" value={formatMoney(rec.riskReduction)} color="var(--risk-low)" />
          </div>
        </SheetSection>

        {/* Industries Affected */}
        {rec.industries.length > 0 && (
          <SheetSection title="INDUSTRIES AFFECTED" icon={Globe}>
            <div className="flex flex-wrap gap-1.5">
              {rec.industries.map((ind) => (
                <span
                  key={ind}
                  className="rounded px-2 py-1 font-data text-[12px]"
                  style={{
                    backgroundColor: "var(--sentinel-bg-elevated)",
                    color: "var(--sentinel-text-secondary)",
                  }}
                >
                  {ind}
                </span>
              ))}
            </div>
          </SheetSection>
        )}

        {/* Watch List */}
        {rec.watch.length > 0 && (
          <SheetSection title="WATCH INDICATORS" icon={Target}>
            <div className="flex flex-col gap-1.5">
              {rec.watch.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="font-data text-sm tabular-nums shrink-0 mt-px"
                    style={{ color: "var(--sentinel-text-tertiary)" }}
                  >
                    {i + 1}.
                  </span>
                  <span
                    className="text-sm leading-snug"
                    style={{ color: "var(--sentinel-text-secondary)" }}
                  >
                    {w}
                  </span>
                </div>
              ))}
            </div>
          </SheetSection>
        )}

        {/* Cascade Exposure */}
        {rec.exposure > 0 && (
          <SheetSection title="CASCADE EXPOSURE" icon={Globe}>
            <div className="flex items-baseline gap-2">
              <span
                className="font-data text-xl font-bold tabular-nums"
                style={{ color: "var(--risk-critical)" }}
              >
                {formatMoney(rec.exposure)}
              </span>
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                at risk
              </span>
            </div>
          </SheetSection>
        )}

        {/* Evidence */}
        <div className="flex items-start gap-2">
          <FileText size={14} className="mt-0.5 shrink-0" style={{ color: "var(--sentinel-text-tertiary)" }} />
          <p
            className="text-sm italic leading-relaxed"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {rec.evidence}
          </p>
        </div>

        {/* Lead Time */}
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span
            className="font-data text-sm"
            style={{ color: "var(--sentinel-text-secondary)" }}
          >
            Lead time: <strong style={{ color: "var(--sentinel-text-primary)" }}>{rec.leadTime}</strong>
          </span>
        </div>
      </div>
    </>
  )
}

// ── Sheet Section Helper ────────────────────────────────────────

function SheetSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Target
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} style={{ color: "var(--sentinel-text-tertiary)" }} />
        <span
          className="font-data text-[11px] font-bold tracking-widest"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {title}
        </span>
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: "var(--sentinel-border-subtle)" }}
        />
      </div>
      {children}
    </div>
  )
}

// ── Metric Box (for cost grid) ──────────────────────────────────

function MetricBox({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border px-3 py-2.5"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <span
        className="font-data text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className="font-data text-xl font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  format,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  format: "money" | "roi" | "count"
  color: string
  icon: typeof Target
}) {
  const prefix = format === "money" ? "$" : ""
  const suffix = format === "roi" ? "x" : ""
  const displayValue = format === "money" ? (value >= 1000 ? +(value / 1000).toFixed(1) : value) : value
  const displaySuffix = format === "money" ? (value >= 1000 ? "B" : "M") : suffix

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col rounded-md border px-4 py-3"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} style={{ color: "var(--sentinel-text-tertiary)" }} />
        <span
          className="text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="font-data text-3xl font-bold leading-none tabular-nums"
        style={{ color }}
      >
        <NumberFlow value={displayValue} prefix={prefix} suffix={displaySuffix} trend={1} />
      </span>
    </motion.div>
  )
}

// ── Hotspot Card ─────────────────────────────────────────────────

function HotspotCard({
  hotspot,
  index,
}: {
  hotspot: {
    name: string
    icon: typeof Target
    riskLevel: RiskLevel
    exposure: number
    description: string
    actionCount: number
    totalCost: number
    coverage: number
  }
  index: number
}) {
  const Icon = hotspot.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="flex flex-col gap-2 rounded-md border p-3"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
        borderLeft: `2px solid ${riskColor[hotspot.riskLevel]}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
            {hotspot.name}
          </span>
        </div>
        <span
          className="rounded px-1.5 py-0.5 font-data text-[11px] font-bold"
          style={{ backgroundColor: "var(--sentinel-bg-elevated)", color: riskColor[hotspot.riskLevel] }}
        >
          {hotspot.riskLevel}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="font-data text-xl font-bold tabular-nums" style={{ color: "var(--sentinel-text-primary)" }}>
          {formatMoney(hotspot.exposure)}
        </span>
        <span className="text-[12px] uppercase tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
          at risk
        </span>
      </div>

      <span className="text-xs leading-snug" style={{ color: "var(--sentinel-text-secondary)" }}>
        {hotspot.description}
      </span>

      <div className="flex items-center gap-3">
        <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          <strong style={{ color: "var(--sentinel-text-secondary)" }}>{hotspot.actionCount}</strong> actions
        </span>
        <span className="font-data text-[12px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          <strong style={{ color: "var(--sentinel-text-secondary)" }}>{formatMoney(hotspot.totalCost)}</strong> cost
        </span>
      </div>

      <div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${hotspot.coverage}%` }}
            transition={{ delay: 0.3 + index * 0.06, duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--sentinel-accent)", opacity: 0.5 }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-data text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            Risk coverage
          </span>
          <span className="font-data text-[11px] font-semibold" style={{ color: "var(--sentinel-text-secondary)" }}>
            {Math.round(hotspot.coverage)}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Action Row ───────────────────────────────────────────────────

function ActionRow({
  rec,
  index,
  onClick,
}: {
  rec: BackendRecommendation
  index: number
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const flag = flagFromAlpha2(rec.countryCode)
  const rLevel = (rec.riskLevel ?? "MODERATE") as RiskLevel

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group rounded-md border cursor-pointer transition-all duration-150"
      style={{
        backgroundColor: hovered ? "var(--sentinel-bg-elevated)" : "var(--sentinel-bg-surface)",
        borderTopColor: hovered ? "var(--sentinel-accent)" : "var(--sentinel-border-subtle)",
        borderRightColor: hovered ? "var(--sentinel-accent)" : "var(--sentinel-border-subtle)",
        borderBottomColor: hovered ? "var(--sentinel-accent)" : "var(--sentinel-border-subtle)",
        borderLeftWidth: 3,
        borderLeftColor: priorityColor[rec.priority],
        boxShadow: hovered ? "0 0 0 1px var(--sentinel-accent), 0 2px 8px rgba(0,0,0,0.1)" : "none",
      }}
    >
      <div className="flex flex-col gap-2 px-4 py-3.5">
        {/* Header line: priority badge + country + risk score */}
        <div className="flex items-center gap-2.5">
          <span
            className="flex items-center gap-1.5 rounded px-2 py-0.5 font-data text-[11px] font-bold tracking-wide"
            style={{ backgroundColor: "var(--sentinel-bg-elevated)", color: priorityColor[rec.priority] }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityColor[rec.priority] }} />
            {priorityLabel[rec.priority]}
          </span>
          <span className="text-base">{flag}</span>
          <span className="text-sm font-medium" style={{ color: "var(--sentinel-text-primary)" }}>
            {rec.countryName}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span
              className="font-data text-lg font-bold tabular-nums leading-none"
              style={{ color: riskColor[rLevel] }}
            >
              {rec.riskScore}
            </span>
          </div>
        </div>

        {/* Action title */}
        <span className="text-base font-bold leading-snug" style={{ color: "var(--sentinel-text-primary)" }}>
          {rec.action}
        </span>

        {/* Description — clamped to 2 lines */}
        <p
          className="text-sm leading-relaxed line-clamp-2"
          style={{ color: "var(--sentinel-text-secondary)" }}
        >
          {rec.description}
        </p>

        {/* Stat strip */}
        <div className="flex items-center gap-1 pt-0.5">
          <span className="font-data text-xs tabular-nums" style={{ color: "var(--sentinel-text-tertiary)" }}>
            <strong className="font-data" style={{ color: "var(--sentinel-text-secondary)" }}>{formatMoney(rec.cost)}</strong> cost
          </span>
          <span className="font-data text-xs" style={{ color: "var(--sentinel-border)" }}>&middot;</span>
          <span className="font-data text-xs tabular-nums" style={{ color: "var(--sentinel-text-tertiary)" }}>
            <strong className="font-data" style={{ color: "var(--sentinel-text-secondary)" }}>{rec.roi > 0 ? `${rec.roi}x` : "—"}</strong> ROI
          </span>
          <span className="font-data text-xs" style={{ color: "var(--sentinel-border)" }}>&middot;</span>
          <span className="font-data text-xs tabular-nums" style={{ color: "var(--sentinel-text-tertiary)" }}>
            <strong className="font-data" style={{ color: "var(--sentinel-text-secondary)" }}>{formatMoney(rec.riskReduction)}</strong> protected
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Clock size={12} style={{ color: "var(--sentinel-text-tertiary)" }} />
            <span className="font-data text-xs font-semibold" style={{ color: "var(--sentinel-text-secondary)" }}>
              {rec.leadTime}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Section Header ───────────────────────────────────────────────

function SectionHeader({
  title,
  icon: Icon,
  count,
}: {
  title: string
  icon: typeof Target
  count: number
}) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-1">
      <Icon size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
      <span className="font-data text-xs font-bold tracking-widest" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {title}
      </span>
      <span className="font-data text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
        ({count})
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />
    </div>
  )
}
