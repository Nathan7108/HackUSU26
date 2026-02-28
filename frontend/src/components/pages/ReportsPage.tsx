import { useQuery } from "@tanstack/react-query"
import { fetchHealth, fetchTrackRecord, type TrackRecordPrediction } from "@/lib/api"
import { useDashboard } from "@/hooks/use-dashboard"
import { riskColor } from "@/lib/risk"
import type { RiskLevel } from "@/types"
import {
  Brain, Database, Cpu, Target, Activity, Clock,
  CheckCircle, XCircle, CircleDot, Layers,
} from "lucide-react"

const RISK_LEVELS: RiskLevel[] = ["CRITICAL", "HIGH", "ELEVATED", "MODERATE", "LOW"]

export function ReportsPage() {
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 30_000 })
  const { data: track } = useQuery({ queryKey: ["track-record"], queryFn: fetchTrackRecord, refetchInterval: 30_000 })
  const { dashboard, isLive } = useDashboard()

  const riskDist = RISK_LEVELS.map((level) => ({
    level,
    count: (dashboard?.countries ?? []).filter((c) => c.riskLevel === level).length,
  }))
  const maxCount = Math.max(...riskDist.map((r) => r.count), 1)

  const accuracy = track?.accuracy
  const predictions = track?.predictions ?? []

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 gap-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
            Model Performance
          </h1>
          <span className="font-data text-[11px] tracking-widest" style={{ color: "var(--sentinel-text-tertiary)" }}>
            SENTINEL AI — LIVE ML PIPELINE METRICS
          </span>
        </div>
        {health && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-data text-[10px] tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
              v{health.version} · UP {health.uptime}
            </span>
          </div>
        )}
      </div>

      {/* KPI cards — all real data */}
      <div className="grid grid-cols-5 gap-2">
        <KpiCard
          icon={Target}
          label="Prediction Accuracy"
          value={accuracy && accuracy.total_evaluated > 0 ? `${accuracy.accuracy_pct}%` : "—"}
          sub={accuracy ? `${accuracy.correct}/${accuracy.total_evaluated} correct (${accuracy.days_back}d)` : "evaluating..."}
          color="var(--risk-low)"
        />
        <KpiCard
          icon={Database}
          label="Features"
          value={String(health?.models.riskScorer.features ?? 47)}
          sub="input dimensions"
          color="var(--sentinel-accent)"
        />
        <KpiCard
          icon={Cpu}
          label="Anomaly Models"
          value={String(health?.models.anomalyDetection.countryModels ?? "—")}
          sub="per-country Isolation Forest"
          color="var(--risk-elevated)"
        />
        <KpiCard
          icon={Layers}
          label="Coverage"
          value={health ? `${health.data.coveragePct}%` : "—"}
          sub={health ? `${health.data.countriesScored}/${health.data.countriesTotal} nations` : "loading..."}
          color="var(--risk-high)"
        />
        <KpiCard
          icon={Activity}
          label="Refresh Cycle"
          value={health ? `${health.data.refreshIntervalMinutes}m` : "—"}
          sub="auto-refresh interval"
          color="var(--risk-moderate)"
        />
      </div>

      {/* Two-column: Pipeline + Model Status */}
      <div className="grid grid-cols-3 gap-3 min-h-0">
        {/* Pipeline architecture — 2/3 width */}
        <div className="col-span-2">
          <SectionTitle title="ML PIPELINE ARCHITECTURE" />
          <Card className="grid grid-cols-4 gap-3 p-3">
            <PipelineStep
              step={1} title="Risk Scorer" engine="XGBoost"
              ready={health?.models.riskScorer.ready ?? false}
              specs={["500 estimators", "47 features", "5-class output", "Score 0–100"]}
            />
            <PipelineStep
              step={2} title="Anomaly Detection" engine="Isolation Forest"
              ready={health?.models.anomalyDetection.ready ?? false}
              specs={[
                `${health?.models.anomalyDetection.countryModels ?? "?"} country models`,
                "6 GDELT features", "Anomaly score 0–1", "Auto severity",
              ]}
            />
            <PipelineStep
              step={3} title="Sentiment" engine="FinBERT"
              ready={true}
              specs={["ProsusAI/finbert", "8 aggregate scores", "Escalatory %", "Media negativity"]}
            />
            <PipelineStep
              step={4} title="Forecaster" engine="LSTM + Attention"
              ready={health?.models.forecaster.ready ?? false}
              specs={["2-layer LSTM", "128 hidden units", "90-day window", "30/60/90d horizons"]}
            />
          </Card>
        </div>

        {/* Model status panel — 1/3 width */}
        <div>
          <SectionTitle title="SYSTEM STATUS" />
          <Card className="flex flex-col gap-2 p-3">
            <StatusRow label="API" ok={health?.api ?? false} detail={health ? `v${health.version}` : "—"} />
            <StatusRow label="ML Engine" ok={health?.ml ?? false} detail={health?.ml ? "loaded" : "loading"} />
            <StatusRow label="Risk Scorer" ok={health?.models.riskScorer.ready ?? false} detail="XGBoost" />
            <StatusRow label="Anomaly" ok={health?.models.anomalyDetection.ready ?? false} detail={`${health?.models.anomalyDetection.countryModels ?? 0} models`} />
            <StatusRow label="Forecaster" ok={health?.models.forecaster.ready ?? false} detail="LSTM" />
            <StatusRow label="Sentiment" ok={true} detail="FinBERT" />
            <StatusRow label="Live Data" ok={isLive} detail={isLive ? "streaming" : "offline"} />
            <div className="mt-1 pt-2" style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--sentinel-text-tertiary)" }}>Last computed</span>
                <span className="font-data text-[11px] font-medium" style={{ color: "var(--sentinel-text-secondary)" }}>
                  {health?.data.lastComputed ? new Date(health.data.lastComputed).toLocaleTimeString() : "—"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Two-column: Risk Distribution + Recent Predictions */}
      <div className="grid grid-cols-3 gap-3 min-h-0 flex-1">
        {/* Risk distribution */}
        <div>
          <SectionTitle title="RISK DISTRIBUTION" />
          <Card className="flex flex-col gap-2 p-3 h-full">
            <div className="flex items-end gap-2 flex-1 min-h-[120px]">
              {riskDist.map(({ level, count }) => (
                <div key={level} className="flex flex-1 flex-col items-center gap-1 h-full justify-end">
                  <span className="font-data text-xs font-bold" style={{ color: (riskColor as Record<string, string>)[level] }}>
                    {count}
                  </span>
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max(6, (count / maxCount) * 100)}%`,
                      backgroundColor: (riskColor as Record<string, string>)[level],
                      opacity: 0.75,
                    }}
                  />
                  <span className="font-data text-[7px] tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
                    {level}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 text-center" style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}>
              <span className="font-data text-[10px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
                {dashboard?.countries.length ?? 0} NATIONS MONITORED
              </span>
            </div>
          </Card>
        </div>

        {/* Recent predictions — real from SQLite tracker */}
        <div className="col-span-2">
          <SectionTitle title="RECENT PREDICTIONS (TRACK RECORD)" />
          <Card className="p-0 h-full overflow-hidden flex flex-col">
            {/* Table header */}
            <div
              className="grid grid-cols-[80px_1fr_80px_80px_80px] gap-2 px-3 py-2 text-[10px] font-data font-bold tracking-wider"
              style={{ color: "var(--sentinel-text-tertiary)", borderBottom: "1px solid var(--sentinel-border-subtle)" }}
            >
              <span>COUNTRY</span>
              <span>TIME</span>
              <span>PREDICTED</span>
              <span className="text-right">SCORE</span>
              <span className="text-center">RESULT</span>
            </div>
            {/* Table rows */}
            <div className="flex-1 overflow-y-auto">
              {predictions.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <span className="text-xs" style={{ color: "var(--sentinel-text-tertiary)" }}>
                    Predictions logged after first refresh cycle...
                  </span>
                </div>
              ) : (
                predictions.map((p, i) => <PredictionRow key={i} prediction={p} />)
              )}
            </div>
            {/* Footer with accuracy summary */}
            {accuracy && accuracy.total_evaluated > 0 && (
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderTop: "1px solid var(--sentinel-border-subtle)", backgroundColor: "var(--sentinel-bg-muted)" }}
              >
                <span className="font-data text-[10px] tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>
                  {accuracy.total_evaluated} EVALUATED · {accuracy.days_back}D WINDOW
                </span>
                <span className="font-data text-xs font-bold" style={{ color: "var(--risk-low)" }}>
                  {accuracy.accuracy_pct}% ACCURATE
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ──────────── Sub-components ──────────── */

function Card({ className = "", children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`rounded-md border ${className}`}
      style={{ backgroundColor: "var(--sentinel-bg-surface)", borderColor: "var(--sentinel-border-subtle)" }}
      {...props}
    >
      {children}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="font-data text-[10px] font-bold tracking-widest" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {title}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Brain; label: string; value: string; sub: string; color: string
}) {
  return (
    <Card className="flex flex-col items-center gap-1 p-3">
      <Icon size={16} style={{ color }} />
      <span className="font-data text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-center" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {label}
      </span>
      <span className="font-data text-[10px] text-center" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {sub}
      </span>
    </Card>
  )
}

function PipelineStep({ step, title, engine, ready, specs }: {
  step: number; title: string; engine: string; ready: boolean; specs: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-data text-[10px] font-bold"
          style={{ backgroundColor: "var(--sentinel-accent-muted)", color: "var(--sentinel-accent)" }}
        >
          {step}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold truncate" style={{ color: "var(--sentinel-text-primary)" }}>{title}</span>
            {ready
              ? <CheckCircle size={10} style={{ color: "var(--risk-low)" }} />
              : <Clock size={10} style={{ color: "var(--sentinel-text-tertiary)" }} />}
          </div>
          <span className="font-data text-[10px]" style={{ color: "var(--sentinel-accent)" }}>{engine}</span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 pl-7">
        {specs.map((s) => (
          <div key={s} className="flex items-center gap-1">
            <CircleDot size={6} style={{ color: "var(--sentinel-border-subtle)" }} />
            <span className="text-[11px]" style={{ color: "var(--sentinel-text-secondary)" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: ok ? "var(--risk-low)" : "var(--sentinel-text-tertiary)" }}
        />
        <span className="text-[12px] font-medium" style={{ color: "var(--sentinel-text-secondary)" }}>{label}</span>
      </div>
      <span className="font-data text-[11px]" style={{ color: ok ? "var(--risk-low)" : "var(--sentinel-text-tertiary)" }}>
        {detail}
      </span>
    </div>
  )
}

function PredictionRow({ prediction: p }: { prediction: TrackRecordPrediction }) {
  const levelColor = (riskColor as Record<string, string>)[p.risk_level] ?? "var(--sentinel-text-secondary)"
  const time = new Date(p.predicted_at)
  const timeStr = `${time.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`

  return (
    <div
      className="grid grid-cols-[80px_1fr_80px_80px_80px] gap-2 px-3 py-1.5 items-center transition-colors"
      style={{ borderBottom: "1px solid var(--sentinel-border-subtle)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--sentinel-bg-muted)" }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
    >
      <span className="font-data text-[12px] font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
        {p.country_code}
      </span>
      <span className="font-data text-[11px] truncate" style={{ color: "var(--sentinel-text-tertiary)" }}>
        {timeStr}
      </span>
      <span className="font-data text-[11px] font-semibold" style={{ color: levelColor }}>
        {p.risk_level}
      </span>
      <span className="font-data text-[12px] text-right tabular-nums" style={{ color: "var(--sentinel-text-primary)" }}>
        {p.risk_score}
      </span>
      <div className="flex justify-center">
        {p.prediction_correct === null ? (
          <span className="font-data text-[10px] tracking-wider" style={{ color: "var(--sentinel-text-tertiary)" }}>PENDING</span>
        ) : p.prediction_correct === 1 ? (
          <CheckCircle size={12} style={{ color: "var(--risk-low)" }} />
        ) : (
          <XCircle size={12} style={{ color: "var(--risk-critical)" }} />
        )}
      </div>
    </div>
  )
}
