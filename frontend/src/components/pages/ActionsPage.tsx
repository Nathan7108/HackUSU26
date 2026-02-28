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
  ArrowRight,
  Anchor,
  Atom,
  Pickaxe,
  Cpu,
  Crosshair,
  FileText,
  BarChart3,
  Globe,
  ChevronRight,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"
import { countries } from "@/data"
import { riskColor, riskMutedColor, formatMoney } from "@/lib/risk"
import type { Country, Recommendation, RiskLevel } from "@/types"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ── Types ────────────────────────────────────────────────────────

interface FlatRecommendation {
  country: Country
  rec: Recommendation
}

interface Hotspot {
  name: string
  icon: typeof Target
  riskLevel: RiskLevel
  countryCodes: string[]
  exposure: number
  description: string
}

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

const hotspots: Hotspot[] = [
  {
    name: "Taiwan Strait",
    icon: Cpu,
    riskLevel: "ELEVATED",
    countryCodes: ["TWN", "KOR"],
    exposure: 680,
    description: "Semiconductor supply chain",
  },
  {
    name: "China Rare Earth",
    icon: Pickaxe,
    riskLevel: "ELEVATED",
    countryCodes: ["CHN"],
    exposure: 420,
    description: "Yttrium & scandium minerals",
  },
  {
    name: "Red Sea / Suez",
    icon: Anchor,
    riskLevel: "CRITICAL",
    countryCodes: ["YEM", "IRN", "EGY", "ISR"],
    exposure: 1100,
    description: "Shipping corridor disruption",
  },
  {
    name: "Russia Titanium",
    icon: Atom,
    riskLevel: "HIGH",
    countryCodes: ["RUS", "UKR"],
    exposure: 190,
    description: "Titanium sanctions exposure",
  },
]

// ── Main Component ───────────────────────────────────────────────

export function ActionsPage() {
  const [filter, setFilter] = useState<"ALL" | Recommendation["priority"]>("ALL")
  const [selected, setSelected] = useState<FlatRecommendation | null>(null)

  // Flatten all recommendations with country reference
  const allRecs = useMemo<FlatRecommendation[]>(
    () =>
      countries
        .filter((c) => c.recommendations && c.recommendations.length > 0)
        .flatMap((c) =>
          c.recommendations!.map((rec) => ({ country: c, rec })),
        ),
    [],
  )

  // Filter and sort: priority first, then ROI descending
  const filteredRecs = useMemo(() => {
    const filtered =
      filter === "ALL" ? allRecs : allRecs.filter((r) => r.rec.priority === filter)
    return [...filtered].sort((a, b) => {
      const pDiff = priorityOrder[a.rec.priority] - priorityOrder[b.rec.priority]
      if (pDiff !== 0) return pDiff
      return b.rec.roi - a.rec.roi
    })
  }, [allRecs, filter])

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalExposure = countries.reduce(
      (sum, c) => sum + (c.exposure?.totalExposure ?? 0),
      0,
    )
    const totalCost = allRecs.reduce((sum, r) => sum + r.rec.cost, 0)
    const totalProtected = allRecs.reduce((sum, r) => sum + r.rec.riskReduction, 0)
    const portfolioRoi = totalCost > 0 ? Math.round(totalProtected / totalCost) : 0
    return { totalExposure, totalCost, totalProtected, portfolioRoi, count: allRecs.length }
  }, [allRecs])

  // Hotspot computed data
  const hotspotData = useMemo(
    () =>
      hotspots.map((h) => {
        const hCountries = countries.filter((c) => h.countryCodes.includes(c.code))
        const hRecs = hCountries.flatMap((c) => c.recommendations ?? [])
        const totalCost = hRecs.reduce((sum, r) => sum + r.cost, 0)
        const totalReduction = hRecs.reduce((sum, r) => sum + r.riskReduction, 0)
        const coverage = h.exposure > 0 ? Math.min(100, (totalReduction / h.exposure) * 100) : 0
        return { ...h, actionCount: hRecs.length, totalCost, totalReduction, coverage }
      }),
    [],
  )

  // Priority counts
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { IMMEDIATE: 0, SHORT_TERM: 0, MEDIUM_TERM: 0 }
    allRecs.forEach((r) => { counts[r.rec.priority] = (counts[r.rec.priority] ?? 0) + 1 })
    return counts
  }, [allRecs])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            Recommended Actions
          </h1>
          <span
            className="font-data text-xs"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            CASCADE PRECISION INDUSTRIES — STRATEGIC MITIGATION PORTFOLIO
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
        <KpiCard
          label="Total Exposure"
          value={kpis.totalExposure}
          format="money"
          color="var(--risk-critical)"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Mitigation Cost"
          value={kpis.totalCost}
          format="money"
          color="var(--sentinel-text-primary)"
          icon={DollarSign}
        />
        <KpiCard
          label="Value Protected"
          value={kpis.totalProtected}
          format="money"
          color="var(--sentinel-text-primary)"
          icon={ShieldCheck}
        />
        <KpiCard
          label="Portfolio ROI"
          value={kpis.portfolioRoi}
          format="roi"
          color="var(--sentinel-text-primary)"
          icon={TrendingDown}
        />
        <KpiCard
          label="Actions Pending"
          value={kpis.count}
          format="count"
          color="var(--sentinel-text-primary)"
          icon={Zap}
        />
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

        {/* Prioritized Actions — header + filter tabs inline */}
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
          <div
            className="flex-1 h-px"
            style={{ backgroundColor: "var(--sentinel-border-subtle)" }}
          />
          <div className="flex items-center gap-1">
            {(["ALL", "IMMEDIATE", "SHORT_TERM", "MEDIUM_TERM"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className="rounded px-2.5 py-1.5 font-data text-[11px] font-semibold tracking-wide transition-colors"
                style={{
                  backgroundColor:
                    filter === type
                      ? "var(--sentinel-accent-muted)"
                      : "transparent",
                  color:
                    filter === type
                      ? "var(--sentinel-accent)"
                      : "var(--sentinel-text-tertiary)",
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
          {filteredRecs.map((item, i) => (
            <ActionRow
              key={`${item.country.code}-${item.rec.action}`}
              item={item}
              index={i}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      </div>

      {/* Action Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto" style={{ backgroundColor: "var(--sentinel-bg-base)" }}>
          {selected && <ActionDetailSheet item={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Action Detail Sheet ─────────────────────────────────────────

function ActionDetailSheet({ item }: { item: FlatRecommendation }) {
  const { country, rec } = item

  return (
    <>
      <SheetHeader className="pb-0">
        {/* Country + Priority */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{country.flag}</span>
            <div>
              <SheetTitle
                className="text-lg font-semibold"
                style={{ color: "var(--sentinel-text-primary)" }}
              >
                {country.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Intelligence brief for {country.name}
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="rounded px-2 py-1 font-data text-[10px] font-bold tracking-wide"
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
                style={{ color: riskColor[country.riskLevel] }}
              >
                {country.score}
              </span>
              <span
                className="font-data text-[9px] uppercase tracking-wider"
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
              className="font-data text-[10px] font-bold uppercase tracking-wide block mb-0.5"
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
            <MetricBox
              label="Cost to Act"
              value={formatMoney(rec.cost)}
              color="var(--sentinel-text-primary)"
            />
            <MetricBox
              label="Cost of Inaction"
              value={formatMoney(rec.costOfInaction)}
              color="var(--risk-critical)"
            />
            <MetricBox
              label="ROI"
              value={rec.roi > 0 ? `${rec.roi}x` : "—"}
              color="var(--sentinel-text-primary)"
            />
            <MetricBox
              label="Value Protected"
              value={formatMoney(rec.riskReduction)}
              color="var(--risk-low)"
            />
          </div>
        </SheetSection>

        {/* Intelligence Brief */}
        <SheetSection title="INTELLIGENCE BRIEF" icon={FileText}>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--sentinel-text-secondary)" }}
          >
            {country.brief}
          </p>
        </SheetSection>

        {/* 90-Day Forecast */}
        {country.forecast.length > 0 && (
          <SheetSection title="LSTM FORECAST (90 DAY)" icon={BarChart3}>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={country.forecast}>
                  <defs>
                    <linearGradient id={`sheet-grad-${country.code}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={riskColor[country.riskLevel]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={riskColor[country.riskLevel]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "var(--sentinel-text-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d) => `${d}d`}
                  />
                  <YAxis
                    domain={["dataMin - 5", "dataMax + 5"]}
                    tick={{ fontSize: 10, fill: "var(--sentinel-text-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke={riskColor[country.riskLevel]}
                    fill={`url(#sheet-grad-${country.code})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SheetSection>
        )}

        {/* Top Risk Drivers */}
        {country.riskDrivers.length > 0 && (
          <SheetSection title="TOP RISK DRIVERS" icon={Target}>
            <div className="flex flex-col gap-2">
              {country.riskDrivers.slice(0, 5).map((driver) => (
                <div key={driver.feature} className="flex items-center gap-2">
                  <span
                    className="font-data text-xs w-48 shrink-0"
                    style={{ color: "var(--sentinel-text-secondary)" }}
                  >
                    {driver.feature.replace(/_/g, " ")}
                  </span>
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${driver.importance * 100}%`,
                        backgroundColor: riskColor[country.riskLevel],
                      }}
                    />
                  </div>
                  <span
                    className="font-data text-xs w-8 text-right tabular-nums"
                    style={{ color: "var(--sentinel-text-tertiary)" }}
                  >
                    {Math.round(driver.importance * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </SheetSection>
        )}

        {/* Cascade Exposure */}
        {country.exposure && (
          <SheetSection title="CASCADE EXPOSURE" icon={Globe}>
            <div className="flex items-baseline gap-2">
              <span
                className="font-data text-xl font-bold tabular-nums"
                style={{ color: "var(--risk-critical)" }}
              >
                {formatMoney(country.exposure.totalExposure)}
              </span>
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                at risk
              </span>
            </div>
            {country.exposure.description && (
              <p
                className="text-sm leading-relaxed mt-1"
                style={{ color: "var(--sentinel-text-secondary)" }}
              >
                {country.exposure.description}
              </p>
            )}
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
          className="font-data text-[10px] font-bold tracking-widest"
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
        className="font-data text-[10px] font-semibold uppercase tracking-wider"
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
  // For NumberFlow we pass numeric value; format with prefix/suffix
  const prefix = format === "money" ? "$" : ""
  const suffix = format === "roi" ? "x" : ""
  // Convert millions to display value for money
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
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="font-data text-3xl font-bold leading-none tabular-nums"
        style={{ color }}
      >
        <NumberFlow
          value={displayValue}
          prefix={prefix}
          suffix={displaySuffix}
          trend={1}
        />
      </span>
    </motion.div>
  )
}

// ── Hotspot Card ─────────────────────────────────────────────────

function HotspotCard({
  hotspot,
  index,
}: {
  hotspot: ReturnType<typeof Object> & {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            {hotspot.name}
          </span>
        </div>
        <span
          className="rounded px-1.5 py-0.5 font-data text-[10px] font-bold"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            color: riskColor[hotspot.riskLevel],
          }}
        >
          {hotspot.riskLevel}
        </span>
      </div>

      {/* Exposure */}
      <div className="flex items-baseline gap-1">
        <span
          className="font-data text-xl font-bold tabular-nums"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          {formatMoney(hotspot.exposure)}
        </span>
        <span
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          at risk
        </span>
      </div>

      {/* Description */}
      <span
        className="text-xs leading-snug"
        style={{ color: "var(--sentinel-text-secondary)" }}
      >
        {hotspot.description}
      </span>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <span className="font-data text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          <strong style={{ color: "var(--sentinel-text-secondary)" }}>{hotspot.actionCount}</strong> actions
        </span>
        <span className="font-data text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          <strong style={{ color: "var(--sentinel-text-secondary)" }}>{formatMoney(hotspot.totalCost)}</strong> cost
        </span>
      </div>

      {/* Coverage bar */}
      <div>
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${hotspot.coverage}%` }}
            transition={{ delay: 0.3 + index * 0.06, duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--sentinel-accent)", opacity: 0.5 }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span
            className="font-data text-[10px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            Risk coverage
          </span>
          <span
            className="font-data text-[10px] font-semibold"
            style={{ color: "var(--sentinel-text-secondary)" }}
          >
            {Math.round(hotspot.coverage)}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Action Row ───────────────────────────────────────────────────

function ActionRow({
  item,
  index,
  onClick,
}: {
  item: FlatRecommendation
  index: number
  onClick: () => void
}) {
  const { country, rec } = item
  const [verb, ...restWords] = rec.action.split(" ")
  const restAction = restWords.join(" ")
  const [hovered, setHovered] = useState(false)

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
      {/* Top bar: priority + country + trigger + lead time */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 border-b"
        style={{ borderColor: "var(--sentinel-border-subtle)" }}
      >
        <span
          className="flex items-center gap-1.5 rounded px-2 py-0.5 font-data text-xs font-bold tracking-wide"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            color: "var(--sentinel-text-secondary)",
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: priorityColor[rec.priority] }}
          />
          {priorityLabel[rec.priority]}
        </span>
        <span className="text-base">{country.flag}</span>
        <span
          className="text-base font-medium"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          {country.name}
        </span>
        <span
          className="h-3.5 w-px"
          style={{ backgroundColor: "var(--sentinel-border)" }}
        />
        <Crosshair size={12} style={{ color: "var(--sentinel-text-tertiary)" }} />
        <span
          className="font-data text-sm"
          style={{ color: "var(--sentinel-text-secondary)" }}
        >
          {rec.trigger}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Clock size={12} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span
            className="font-data text-sm"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {rec.leadTime}
          </span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex gap-4 p-4">
        {/* Left: Action + Reasoning */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          {/* Action line */}
          <div>
            <span
              className="text-lg font-bold mr-1.5"
              style={{ color: "var(--sentinel-text-primary)" }}
            >
              {verb}
            </span>
            <span
              className="text-lg font-semibold"
              style={{ color: "var(--sentinel-text-primary)" }}
            >
              {restAction}
            </span>
          </div>

          {/* Reasoning — dynamically composed from structured country + rec data */}
          <div className="flex flex-col gap-2">
            <span
              className="font-data text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              REASONING
            </span>
            {/* Action description */}
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--sentinel-text-secondary)" }}
            >
              {rec.description}
            </p>
            {/* Intelligence context from country brief */}
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--sentinel-text-secondary)" }}
            >
              {country.brief}
            </p>
            {/* Causal chain — top 3 drivers from ML pipeline */}
            <div className="flex flex-col gap-1 mt-0.5">
              {country.causalChain.slice(0, 3).map((step, i) => (
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
                    {step}
                  </span>
                </div>
              ))}
            </div>
            {/* Risk score + trend context */}
            <div className="flex items-center gap-4 mt-1">
              <span
                className="font-data text-sm"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                Risk Score:{" "}
                <strong style={{ color: riskColor[country.riskLevel] }}>
                  {country.score} {country.riskLevel}
                </strong>
              </span>
              <span
                className="font-data text-sm"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                Trend:{" "}
                <strong style={{ color: "var(--sentinel-text-secondary)" }}>
                  {country.trend} ({country.trendDelta > 0 ? "+" : ""}{country.trendDelta})
                </strong>
              </span>
              <span
                className="font-data text-sm"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                Confidence:{" "}
                <strong style={{ color: "var(--sentinel-text-secondary)" }}>
                  {Math.round(country.confidence * 100)}%
                </strong>
              </span>
              {country.exposure && (
                <span
                  className="font-data text-sm"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  Exposure:{" "}
                  <strong style={{ color: "var(--risk-critical)" }}>
                    {formatMoney(country.exposure.totalExposure)}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* Evidence */}
          <div className="flex items-start gap-2 mt-auto">
            <FileText size={13} className="mt-0.5 shrink-0" style={{ color: "var(--sentinel-text-tertiary)" }} />
            <p
              className="text-sm italic leading-snug"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              {rec.evidence}
            </p>
          </div>
        </div>

        {/* Right: Cost data + CTA */}
        <div
          className="shrink-0 flex flex-col gap-3 rounded-md p-4"
          style={{
            backgroundColor: "var(--sentinel-bg-overlay)",
            width: 240,
          }}
        >
          {/* Cost to Act */}
          <div className="flex items-center justify-between">
            <span
              className="font-data text-xs uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              Cost to act
            </span>
            <span
              className="font-data text-lg font-bold tabular-nums"
              style={{ color: "var(--sentinel-text-primary)" }}
            >
              {formatMoney(rec.cost)}
            </span>
          </div>

          {/* Cost of Inaction */}
          <div className="flex items-center justify-between">
            <span
              className="font-data text-xs uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              If you don't
            </span>
            <span
              className="font-data text-lg font-bold tabular-nums"
              style={{ color: "var(--risk-critical)" }}
            >
              {formatMoney(rec.costOfInaction)}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />

          {/* ROI + Risk Reduction */}
          <div className="flex items-center justify-between">
            <span
              className="font-data text-xs uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              ROI
            </span>
            <span
              className="font-data text-lg font-bold tabular-nums"
              style={{ color: "var(--sentinel-text-primary)" }}
            >
              {rec.roi > 0 ? `${rec.roi}x` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span
              className="font-data text-xs uppercase tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              Protected
            </span>
            <span
              className="font-data text-lg font-bold tabular-nums"
              style={{ color: "var(--risk-low)" }}
            >
              {formatMoney(rec.riskReduction)}
            </span>
          </div>

          {/* View Brief CTA */}
          <div
            className="flex items-center justify-center gap-1.5 mt-auto rounded px-2 py-2 transition-all duration-150"
            style={{
              backgroundColor: hovered ? "var(--sentinel-accent-muted)" : "var(--sentinel-bg-elevated)",
              color: hovered ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
            }}
          >
            <span className="font-data text-sm font-semibold tracking-wide">
              VIEW BRIEF
            </span>
            <ChevronRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
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
      <span
        className="font-data text-xs font-bold tracking-widest"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {title}
      </span>
      <span
        className="font-data text-xs"
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
