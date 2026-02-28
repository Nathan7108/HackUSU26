import { useState, useMemo, memo } from "react"
import { useDashboard } from "@/hooks/use-dashboard"
import { useLiveFeeds } from "@/hooks/use-live-feeds"
import { riskColor, riskMutedColor, timeAgo } from "@/lib/risk"
import { getCountryByCode } from "@/data"
import {
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Activity,
  Search,
  Radio,
  Zap,
  Globe,
  Mountain,
  Flame,
  ShieldAlert,
  WifiOff,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react"
import type { Alert, RiskLevel } from "@/types"
import type {
  USGSEvent,
  GDACSAlert,
  ReliefWebReport,
  NASAEvent,
  OONIIncident,
} from "@/lib/api"

// ── Icon + label maps ──────────────────────────────────────────

const alertIcons: Record<Alert["type"], typeof AlertTriangle> = {
  ANOMALY_DETECTED: Activity,
  SCORE_SPIKE: TrendingUp,
  TIER_CHANGE: ArrowUpRight,
  FORECAST_SHIFT: TrendingUp,
}

const typeLabels: Record<Alert["type"], string> = {
  ANOMALY_DETECTED: "Anomaly Detected",
  SCORE_SPIKE: "Score Spike",
  TIER_CHANGE: "Tier Change",
  FORECAST_SHIFT: "Forecast Shift",
}

const severityOrder: RiskLevel[] = ["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"]

// ── Main Component ─────────────────────────────────────────────

export function AlertsPage() {
  const { dashboard, isLive, isLoading } = useDashboard()
  const { data: liveFeeds } = useLiveFeeds()
  const [filterType, setFilterType] = useState<Alert["type"] | "ALL">("ALL")
  const [filterSeverity, setFilterSeverity] = useState<RiskLevel | "ALL">("ALL")
  const [search, setSearch] = useState("")

  const alerts = dashboard.alerts
  const sorted = useMemo(() => {
    let list = [...alerts]
    if (filterType !== "ALL") list = list.filter((a) => a.type === filterType)
    if (filterSeverity !== "ALL") list = list.filter((a) => a.severity === filterSeverity)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.countryName.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [alerts, filterType, filterSeverity, search])

  // Severity counts for the summary strip
  const severityCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 0, ELEVATED: 0, MODERATE: 0, LOW: 0 }
    for (const a of alerts) counts[a.severity]++
    return counts
  }, [alerts])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--risk-critical)" }}
                />
                <span
                  className="absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: "var(--risk-critical)", opacity: 0.4 }}
                />
              </div>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--sentinel-text-primary)" }}>
                Alert Center
              </h1>
            </div>
            <span
              className="rounded-full px-2 py-0.5 font-data text-[9px] font-semibold"
              style={{
                backgroundColor: isLive ? "rgba(34, 197, 94, 0.15)" : "var(--sentinel-bg-elevated)",
                color: isLive ? "#22c55e" : "var(--sentinel-text-tertiary)",
              }}
            >
              {isLive ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <span className="font-data text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {alerts.length} ACTIVE ALERTS — REAL-TIME ML MONITORING ACROSS {dashboard.countries.length} COUNTRIES
          </span>
        </div>

        {/* Search */}
        <div
          className="flex h-8 w-56 items-center gap-2 rounded-md px-2.5"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            border: "1px solid var(--sentinel-border-subtle)",
          }}
        >
          <Search size={13} style={{ color: "var(--sentinel-text-tertiary)" }} />
          <input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
            style={{ color: "var(--sentinel-text-primary)" }}
          />
        </div>
      </div>

      {/* ── Severity Summary Strip ───────────────────── */}
      <div className="flex gap-2 px-1 mb-3">
        {severityOrder.map((level) => (
          <button
            key={level}
            onClick={() => setFilterSeverity(filterSeverity === level ? "ALL" : level)}
            className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 transition-all"
            style={{
              backgroundColor: filterSeverity === level
                ? riskMutedColor[level]
                : "var(--sentinel-bg-surface)",
              border: `1px solid ${filterSeverity === level ? riskColor[level] : "var(--sentinel-border-subtle)"}`,
              opacity: filterSeverity !== "ALL" && filterSeverity !== level ? 0.5 : 1,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: riskColor[level] }}
            />
            <div className="flex flex-col items-start">
              <span className="font-data text-base font-bold" style={{ color: riskColor[level] }}>
                {severityCounts[level]}
              </span>
              <span className="font-data text-[8px] font-semibold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
                {level}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Type Filters ─────────────────────────────── */}
      <div className="flex items-center gap-1 px-1 mb-3">
        {(["ALL", "ANOMALY_DETECTED", "SCORE_SPIKE", "TIER_CHANGE", "FORECAST_SHIFT"] as const).map(
          (type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-data text-[10px] font-semibold transition-colors"
              style={{
                backgroundColor: filterType === type ? "var(--sentinel-accent-muted)" : "transparent",
                color: filterType === type ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
              }}
            >
              {type !== "ALL" && (() => {
                const Icon = alertIcons[type]
                return <Icon size={11} />
              })()}
              {type === "ALL" ? "ALL TYPES" : typeLabels[type].toUpperCase()}
            </button>
          ),
        )}
        {(filterType !== "ALL" || filterSeverity !== "ALL" || search) && (
          <button
            onClick={() => { setFilterType("ALL"); setFilterSeverity("ALL"); setSearch("") }}
            className="ml-auto rounded px-2 py-1 text-[10px] font-medium transition-colors"
            style={{ color: "var(--sentinel-accent)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Main Content: Alerts + Live Feeds ────────── */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Alert List */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="flex items-center justify-between rounded-t-lg border border-b-0 px-4 py-2"
            style={{
              backgroundColor: "var(--sentinel-bg-muted)",
              borderColor: "var(--sentinel-border-subtle)",
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert size={13} style={{ color: "var(--sentinel-text-tertiary)" }} />
              <span className="font-data text-[10px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
                ML-GENERATED ALERTS
              </span>
            </div>
            <span className="font-data text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {sorted.length} of {alerts.length}
            </span>
          </div>

          <div
            className="flex-1 overflow-y-auto rounded-b-lg border"
            style={{
              backgroundColor: "var(--sentinel-bg-surface)",
              borderColor: "var(--sentinel-border-subtle)",
            }}
          >
            {isLoading && alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div
                  className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--sentinel-accent)", borderTopColor: "transparent" }}
                />
                <span className="text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
                  Connecting to ML pipeline...
                </span>
              </div>
            )}
            {!isLoading && sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <ShieldAlert size={24} style={{ color: "var(--sentinel-text-tertiary)", opacity: 0.4 }} />
                <span className="text-sm font-medium" style={{ color: "var(--sentinel-text-tertiary)" }}>
                  No alerts match filters
                </span>
              </div>
            )}
            {sorted.map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} isFirst={i === 0} />
            ))}
          </div>
        </div>

        {/* Live Intelligence Feeds Sidebar */}
        <div className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto">
          <div
            className="flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2"
            style={{
              backgroundColor: "var(--sentinel-bg-muted)",
              borderColor: "var(--sentinel-border-subtle)",
            }}
          >
            <Radio size={12} style={{ color: "#22c55e" }} />
            <span className="font-data text-[10px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
              LIVE INTELLIGENCE FEEDS
            </span>
          </div>
          <div className="flex flex-col gap-2 -mt-2">
            {/* USGS Earthquakes */}
            <LiveFeedCard
              title="USGS Seismic"
              icon={<Mountain size={14} />}
              color="#f97316"
              count={liveFeeds?.usgs_earthquakes?.count}
              fetchedAt={liveFeeds?.usgs_earthquakes?.fetchedAt}
            >
              {liveFeeds?.usgs_earthquakes?.events?.slice(0, 4).map((eq, i) => (
                <EarthquakeRow key={i} event={eq} />
              ))}
              {!liveFeeds?.usgs_earthquakes?.events?.length && (
                <EmptyFeed label="No significant seismic activity" />
              )}
            </LiveFeedCard>

            {/* GDACS Disaster Alerts */}
            <LiveFeedCard
              title="GDACS Disasters"
              icon={<AlertTriangle size={14} />}
              color="#ef4444"
              count={liveFeeds?.gdacs_alerts?.count}
              fetchedAt={liveFeeds?.gdacs_alerts?.fetchedAt}
            >
              {liveFeeds?.gdacs_alerts?.alerts?.slice(0, 4).map((alert, i) => (
                <GDACSRow key={i} alert={alert} />
              ))}
              {!liveFeeds?.gdacs_alerts?.alerts?.length && (
                <EmptyFeed label="No active disaster alerts" />
              )}
            </LiveFeedCard>

            {/* ReliefWeb */}
            <LiveFeedCard
              title="ReliefWeb"
              icon={<FileText size={14} />}
              color="#3b82f6"
              count={liveFeeds?.reliefweb_reports?.count}
              fetchedAt={liveFeeds?.reliefweb_reports?.fetchedAt}
            >
              {liveFeeds?.reliefweb_reports?.reports?.slice(0, 4).map((report, i) => (
                <ReliefWebRow key={i} report={report} />
              ))}
              {!liveFeeds?.reliefweb_reports?.reports?.length && (
                <EmptyFeed label="No recent reports" />
              )}
            </LiveFeedCard>

            {/* NASA EONET */}
            <LiveFeedCard
              title="NASA EONET"
              icon={<Flame size={14} />}
              color="#eab308"
              count={liveFeeds?.nasa_eonet?.count}
              fetchedAt={liveFeeds?.nasa_eonet?.fetchedAt}
            >
              {liveFeeds?.nasa_eonet?.events?.slice(0, 4).map((event, i) => (
                <NASARow key={i} event={event} />
              ))}
              {!liveFeeds?.nasa_eonet?.events?.length && (
                <EmptyFeed label="No active natural events" />
              )}
            </LiveFeedCard>

            {/* OONI Censorship */}
            <LiveFeedCard
              title="OONI Censorship"
              icon={<WifiOff size={14} />}
              color="#a78bfa"
              count={liveFeeds?.ooni_censorship?.count}
              fetchedAt={liveFeeds?.ooni_censorship?.fetchedAt}
            >
              {liveFeeds?.ooni_censorship?.incidents?.slice(0, 3).map((inc, i) => (
                <OONIRow key={i} incident={inc} />
              ))}
              {!liveFeeds?.ooni_censorship?.incidents?.length && (
                <EmptyFeed label="No censorship incidents" />
              )}
            </LiveFeedCard>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Alert Card ──────────────────────────────────────────────────

const AlertCard = memo(function AlertCard({ alert, isFirst }: { alert: Alert; isFirst: boolean }) {
  const Icon = alertIcons[alert.type]
  const country = getCountryByCode(alert.countryCode)
  const flag = country?.flag ?? ""

  return (
    <div
      className="flex gap-3 border-b px-4 py-3.5 transition-colors last:border-b-0"
      style={{
        borderColor: "var(--sentinel-border-subtle)",
        borderLeft: `3px solid ${riskColor[alert.severity]}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      {/* Severity + Icon */}
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: riskMutedColor[alert.severity],
            color: riskColor[alert.severity],
          }}
        >
          <Icon size={16} />
        </div>
        {isFirst && (
          <span
            className="rounded px-1 py-px font-data text-[7px] font-bold"
            style={{ backgroundColor: "var(--sentinel-accent-muted)", color: "var(--sentinel-accent)" }}
          >
            NEW
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {flag && <span className="text-sm shrink-0">{flag}</span>}
            <span
              className="text-sm font-semibold leading-tight"
              style={{ color: "var(--sentinel-text-primary)" }}
            >
              {alert.title}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Clock size={10} style={{ color: "var(--sentinel-text-tertiary)" }} />
            <span className="font-data text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {timeAgo(alert.timestamp)}
            </span>
          </div>
        </div>

        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--sentinel-text-secondary)" }}
        >
          {alert.description}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span
            className="rounded px-1.5 py-0.5 font-data text-[8px] font-bold tracking-wide"
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
          <span className="font-data text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {alert.countryName}
          </span>
          <span className="font-data text-[10px] ml-auto" style={{ color: "var(--sentinel-text-tertiary)" }}>
            {alert.countryCode}
          </span>
        </div>
      </div>
    </div>
  )
})

// ── Live Feed Card Shell ────────────────────────────────────────

function LiveFeedCard({
  title,
  icon,
  color,
  count,
  fetchedAt,
  children,
}: {
  title: string
  icon: React.ReactNode
  color: string
  count?: number
  fetchedAt?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      {/* Feed header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "var(--sentinel-border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color }}>{icon}</div>
          <span className="font-data text-[10px] font-bold tracking-wider" style={{ color: "var(--sentinel-text-secondary)" }}>
            {title.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {count != null && (
            <span
              className="rounded-full px-1.5 py-px font-data text-[9px] font-bold"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {count}
            </span>
          )}
          {fetchedAt && (
            <span className="font-data text-[8px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {timeAgo(fetchedAt)}
            </span>
          )}
        </div>
      </div>
      {/* Feed items */}
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

// ── Feed Row Components ─────────────────────────────────────────

function EarthquakeRow({ event }: { event: USGSEvent }) {
  const magColor = event.magnitude >= 6 ? "#ef4444" : event.magnitude >= 5 ? "#f97316" : "#eab308"
  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 transition-colors group"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded font-data text-[11px] font-bold"
        style={{ backgroundColor: `${magColor}20`, color: magColor }}
      >
        {event.magnitude.toFixed(1)}
      </span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium leading-tight truncate" style={{ color: "var(--sentinel-text-primary)" }}>
          {event.place}
        </span>
        <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          {event.depth_km.toFixed(0)}km depth — {timeAgo(event.time)}
        </span>
      </div>
      <ExternalLink size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--sentinel-text-tertiary)" }} />
    </a>
  )
}

function GDACSRow({ alert }: { alert: GDACSAlert }) {
  const levelColor = alert.alertLevel === "Red" ? "#ef4444" : alert.alertLevel === "Orange" ? "#f97316" : "#22c55e"
  const typeIcon = alert.eventType === "EQ" ? "Earthquake" : alert.eventType === "TC" ? "Cyclone" : alert.eventType === "FL" ? "Flood" : alert.eventType === "VO" ? "Volcano" : alert.eventType
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${levelColor}20`, color: levelColor }}
      >
        <Zap size={11} />
      </span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium leading-tight truncate" style={{ color: "var(--sentinel-text-primary)" }}>
          {alert.name || typeIcon}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded px-1 py-px font-data text-[7px] font-bold"
            style={{ backgroundColor: `${levelColor}20`, color: levelColor }}
          >
            {alert.alertLevel?.toUpperCase()}
          </span>
          {alert.country && (
            <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {alert.country}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ReliefWebRow({ report }: { report: ReliefWebReport }) {
  return (
    <a
      href={report.url ? `https://reliefweb.int${report.url}` : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 px-3 py-2 border-b last:border-b-0 transition-colors group"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      <Globe size={12} className="shrink-0 mt-0.5" style={{ color: "#3b82f6" }} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium leading-tight line-clamp-2" style={{ color: "var(--sentinel-text-primary)" }}>
          {report.title}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {report.countries?.slice(0, 2).map((c) => (
            <span key={c} className="font-data text-[8px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {c}
            </span>
          ))}
          {report.date && (
            <span className="font-data text-[8px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {timeAgo(report.date)}
            </span>
          )}
        </div>
      </div>
      <ExternalLink size={10} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--sentinel-text-tertiary)" }} />
    </a>
  )
}

function NASARow({ event }: { event: NASAEvent }) {
  const catColor = event.categories?.includes("Wildfires") ? "#ef4444"
    : event.categories?.includes("Volcanoes") ? "#f97316"
    : event.categories?.includes("Severe Storms") ? "#a78bfa"
    : "#eab308"
  return (
    <a
      href={event.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 transition-colors group"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      <Flame size={12} className="shrink-0" style={{ color: catColor }} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium leading-tight truncate" style={{ color: "var(--sentinel-text-primary)" }}>
          {event.title}
        </span>
        <div className="flex items-center gap-1.5">
          {event.categories?.slice(0, 1).map((c) => (
            <span key={c} className="font-data text-[8px]" style={{ color: catColor }}>
              {c}
            </span>
          ))}
          {event.date && (
            <span className="font-data text-[8px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {timeAgo(event.date)}
            </span>
          )}
        </div>
      </div>
      <ExternalLink size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--sentinel-text-tertiary)" }} />
    </a>
  )
}

function OONIRow({ incident }: { incident: OONIIncident }) {
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2 border-b last:border-b-0"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
    >
      <WifiOff size={12} className="shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium leading-tight line-clamp-2" style={{ color: "var(--sentinel-text-primary)" }}>
          {incident.title}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {incident.CCs?.slice(0, 3).map((cc) => (
            <span key={cc} className="rounded px-1 py-px font-data text-[7px] font-bold"
              style={{ backgroundColor: "rgba(167, 139, 250, 0.15)", color: "#a78bfa" }}
            >
              {cc}
            </span>
          ))}
          {incident.startTime && (
            <span className="font-data text-[8px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
              {timeAgo(incident.startTime)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyFeed({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="text-[10px]" style={{ color: "var(--sentinel-text-tertiary)", opacity: 0.6 }}>
        {label}
      </span>
    </div>
  )
}
