import { mlStats, countries } from "@/data"
import { riskColor } from "@/lib/risk"
import { Brain, Database, Cpu, Target, CheckCircle, BarChart3 } from "lucide-react"

export function ReportsPage() {
  const riskDist = {
    CRITICAL: countries.filter((c) => c.riskLevel === "CRITICAL").length,
    HIGH: countries.filter((c) => c.riskLevel === "HIGH").length,
    ELEVATED: countries.filter((c) => c.riskLevel === "ELEVATED").length,
    MODERATE: countries.filter((c) => c.riskLevel === "MODERATE").length,
    LOW: countries.filter((c) => c.riskLevel === "LOW").length,
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col mb-4">
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          Model Performance
        </h1>
        <span
          className="font-data text-[10px]"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          SENTINEL AI — ML PIPELINE METRICS
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <StatCard icon={Target} label="Model Accuracy" value={`${mlStats.accuracy}%`} color="var(--risk-low)" />
        <StatCard icon={Database} label="Features" value={String(mlStats.features)} color="var(--sentinel-accent)" />
        <StatCard icon={Cpu} label="Country Models" value={String(mlStats.models)} color="var(--risk-elevated)" />
        <StatCard icon={BarChart3} label="Data Sources" value={String(mlStats.sources)} color="var(--risk-high)" />
        <StatCard icon={Brain} label="History Depth" value={mlStats.depth} color="var(--risk-moderate)" />
      </div>

      {/* ML Pipeline */}
      <SectionTitle title="ML PIPELINE ARCHITECTURE" />
      <div
        className="rounded-md border p-4 mb-4"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          borderColor: "var(--sentinel-border-subtle)",
        }}
      >
        <div className="grid grid-cols-4 gap-4">
          <PipelineStep
            step={1}
            title="Risk Scorer"
            subtitle="XGBoost"
            details={["500 estimators", "47 features input", "5-class output", "Score 0-100"]}
          />
          <PipelineStep
            step={2}
            title="Anomaly Detection"
            subtitle="Isolation Forest"
            details={["Per-country models", "6 GDELT features", "Anomaly score 0-1", "Auto severity"]}
          />
          <PipelineStep
            step={3}
            title="Sentiment"
            subtitle="FinBERT"
            details={["ProsusAI/finbert", "8 aggregate scores", "Escalatory %", "Media negativity"]}
          />
          <PipelineStep
            step={4}
            title="Forecaster"
            subtitle="LSTM + Attention"
            details={["2-layer LSTM", "128 hidden units", "90-day window", "30/60/90d output"]}
          />
        </div>
      </div>

      {/* Risk distribution */}
      <SectionTitle title="CURRENT RISK DISTRIBUTION" />
      <div
        className="rounded-md border p-4"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          borderColor: "var(--sentinel-border-subtle)",
        }}
      >
        <div className="flex items-end gap-3 h-32">
          {(Object.entries(riskDist) as [string, number][]).map(([level, count]) => (
            <div key={level} className="flex flex-1 flex-col items-center gap-1">
              <span
                className="font-data text-xs font-bold"
                style={{ color: (riskColor as Record<string, string>)[level] }}
              >
                {count}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(8, (count / countries.length) * 100)}%`,
                  backgroundColor: (riskColor as Record<string, string>)[level],
                  opacity: 0.8,
                }}
              />
              <span
                className="font-data text-[8px] tracking-wider"
                style={{ color: "var(--sentinel-text-tertiary)" }}
              >
                {level}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Brain
  label: string
  value: string
  color: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-md border p-4"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <Icon size={20} style={{ color }} />
      <span className="font-data text-2xl font-bold" style={{ color }}>
        {value}
      </span>
      <span
        className="text-[9px] uppercase tracking-wider text-center"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {label}
      </span>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="font-data text-[10px] font-bold tracking-widest"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {title}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--sentinel-border-subtle)" }} />
    </div>
  )
}

function PipelineStep({
  step,
  title,
  subtitle,
  details,
}: {
  step: number
  title: string
  subtitle: string
  details: string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full font-data text-[10px] font-bold"
          style={{
            backgroundColor: "var(--sentinel-accent-muted)",
            color: "var(--sentinel-accent)",
          }}
        >
          {step}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
            {title}
          </span>
          <span className="font-data text-[9px]" style={{ color: "var(--sentinel-accent)" }}>
            {subtitle}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 pl-8">
        {details.map((d) => (
          <div key={d} className="flex items-center gap-1">
            <CheckCircle size={8} style={{ color: "var(--risk-low)" }} />
            <span className="text-[10px]" style={{ color: "var(--sentinel-text-secondary)" }}>
              {d}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
