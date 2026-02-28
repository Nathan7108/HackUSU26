import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import NumberFlow from "@number-flow/react"
import { X, TrendingUp, AlertTriangle, Factory, Route, ChevronRight, Loader2, Zap, ArrowRight } from "lucide-react"
import { useRouter } from "@tanstack/react-router"
import { useAppStore } from "@/stores/app"
import { getCountryByCode } from "@/data"
import { useAnalysis, useForecast, useDashboard } from "@/hooks/use-dashboard"
import { riskColor, riskMutedColor, trendIcon, trendColor, formatMoney } from "@/lib/risk"
import type { Country, Recommendation } from "@/types"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from "recharts"

export function IntelPanel() {
  const { selectedCountryCode, setIntelPanelOpen } = useAppStore()
  const { dashboard } = useDashboard()
  const mockCountry = selectedCountryCode ? getCountryByCode(selectedCountryCode) : null
  const dashboardCountry = selectedCountryCode
    ? dashboard.countries.find((c) => c.code === selectedCountryCode) ?? null
    : null
  const { data: liveOverlay, isLoading: isAnalyzing } = useAnalysis(selectedCountryCode)
  const { data: liveForecast } = useForecast(selectedCountryCode)

  // Merge: backend analysis overlays on top of mock data, fall back to dashboard country
  const baseCountry = mockCountry ?? dashboardCountry
  const country: Country | null = baseCountry
    ? {
        ...baseCountry,
        ...liveOverlay,
        ...(liveForecast ? { forecast: liveForecast.forecast, trend: liveForecast.trend } : {}),
      }
    : null

  if (!country) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={country.code}
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="flex w-96 shrink-0 flex-col overflow-y-auto rounded-md border ml-2"
        style={{
          backgroundColor: "var(--sentinel-bg-surface)",
          borderColor: "var(--sentinel-border-subtle)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--sentinel-border-subtle)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{country.flag}</span>
            <div className="flex flex-col">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--sentinel-text-primary)" }}
              >
                {country.name}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  {country.code} — INTELLIGENCE BRIEF
                </span>
                <span
                  className="rounded px-1.5 py-0.5 font-data text-[8px] font-bold tracking-wider"
                  style={{
                    backgroundColor: liveOverlay ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.12)",
                    color: liveOverlay ? "var(--risk-low)" : "var(--risk-elevated)",
                  }}
                >
                  {liveOverlay ? "LIVE" : "MOCK"}
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAnalyzing && (
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "var(--sentinel-accent)" }}
              />
            )}
            <button
              onClick={() => setIntelPanelOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--sentinel-text-tertiary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--sentinel-bg-overlay)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Score hero */}
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex flex-col items-center">
            <span
              className="font-data text-4xl font-bold leading-none"
              style={{ color: riskColor[country.riskLevel] }}
            >
              <NumberFlow value={country.score} trend={1} />
            </span>
            <span
              className="mt-1 rounded px-2 py-0.5 font-data text-[10px] font-semibold"
              style={{
                backgroundColor: riskMutedColor[country.riskLevel],
                color: riskColor[country.riskLevel],
              }}
            >
              {country.riskLevel}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="font-data text-sm font-semibold"
                style={{ color: trendColor[country.trend] }}
              >
                {trendIcon[country.trend]} {country.trend}
              </span>
              <span
                className="font-data text-xs"
                style={{ color: trendColor[country.trend] }}
              >
                ({country.trendDelta > 0 ? "+" : ""}{country.trendDelta} 24h)
              </span>
            </div>
            <span
              className="font-data text-[10px]"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              Confidence: {Math.round(country.confidence * 100)}%
            </span>
            {country.isAnomaly && (
              <div className="flex items-center gap-1 mt-0.5">
                <AlertTriangle size={11} style={{ color: "var(--risk-critical)" }} />
                <span
                  className="font-data text-[10px] font-semibold"
                  style={{ color: "var(--risk-critical)" }}
                >
                  ANOMALY: {country.anomalyDriver}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brief */}
        <Section title="INTELLIGENCE SUMMARY">
          {isAnalyzing && !liveOverlay ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Loader2
                  size={12}
                  className="animate-spin"
                  style={{ color: "var(--sentinel-accent)" }}
                />
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  Generating live intelligence brief...
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[100, 95, 80, 60].map((w) => (
                  <div
                    key={w}
                    className="h-2.5 rounded animate-pulse"
                    style={{
                      width: `${w}%`,
                      backgroundColor: "var(--sentinel-bg-overlay)",
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: "var(--sentinel-text-secondary)" }}
            >
              {country.brief}
            </p>
          )}
        </Section>

        {/* Causal Chain */}
        <Section title="CAUSAL CHAIN ANALYSIS">
          {isAnalyzing && !liveOverlay ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex gap-2 py-1.5">
                  <div
                    className="h-5 w-5 shrink-0 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}
                  />
                  <div
                    className="h-3 flex-1 rounded animate-pulse"
                    style={{
                      width: `${90 - n * 5}%`,
                      backgroundColor: "var(--sentinel-bg-overlay)",
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {country.causalChain.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className="flex gap-2 py-1.5"
                >
                  <div className="flex flex-col items-center">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-data text-[9px] font-bold"
                      style={{
                        backgroundColor: riskMutedColor[country.riskLevel],
                        color: riskColor[country.riskLevel],
                      }}
                    >
                      {i + 1}
                    </span>
                    {i < country.causalChain.length - 1 && (
                      <div
                        className="flex-1 w-px my-0.5"
                        style={{ backgroundColor: "var(--sentinel-border)" }}
                      />
                    )}
                  </div>
                  <span
                    className="text-[11px] leading-snug pt-0.5"
                    style={{ color: "var(--sentinel-text-secondary)" }}
                  >
                    {step}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </Section>

        {/* Forecast chart */}
        <Section title="LSTM FORECAST (90 DAY)">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={country.forecast}>
                <defs>
                  <linearGradient id={`grad-${country.code}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={riskColor[country.riskLevel]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={riskColor[country.riskLevel]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: "var(--sentinel-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d) => `${d}d`}
                />
                <YAxis
                  domain={["dataMin - 5", "dataMax + 5"]}
                  tick={{ fontSize: 9, fill: "var(--sentinel-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={riskColor[country.riskLevel]}
                  fill={`url(#grad-${country.code})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Risk Drivers */}
        <Section title="TOP RISK DRIVERS">
          <div className="flex flex-col gap-2">
            {country.riskDrivers.map((driver) => (
              <div key={driver.feature} className="flex items-center gap-2">
                <span
                  className="font-data text-[10px] w-40 truncate"
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
                  className="font-data text-[10px] w-8 text-right"
                  style={{ color: "var(--sentinel-text-tertiary)" }}
                >
                  {Math.round(driver.importance * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Headlines / Key Factors */}
        <Section title="LATEST INTELLIGENCE">
          {isAnalyzing && !liveOverlay ? (
            <div className="flex flex-col gap-1.5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="flex gap-2 rounded-md px-2 py-2.5"
                  style={{ backgroundColor: "var(--sentinel-bg-elevated)" }}
                >
                  <div
                    className="h-1.5 w-1.5 mt-1 shrink-0 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--sentinel-bg-overlay)" }}
                  />
                  <div
                    className="h-3 rounded animate-pulse"
                    style={{
                      width: `${95 - n * 10}%`,
                      backgroundColor: "var(--sentinel-bg-overlay)",
                    }}
                  />
                </div>
              ))}
            </div>
          ) : country.headlines.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {country.headlines.map((headline, i) => (
                <div
                  key={i}
                  className="flex gap-2 rounded-md px-2 py-1.5"
                  style={{ backgroundColor: "var(--sentinel-bg-elevated)" }}
                >
                  <span
                    className="h-1.5 w-1.5 mt-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        headline.sentiment === "negative"
                          ? "var(--sentiment-negative)"
                          : headline.sentiment === "positive"
                            ? "var(--sentiment-positive)"
                            : "var(--sentiment-neutral)",
                    }}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-[11px] leading-snug"
                      style={{ color: "var(--sentinel-text-primary)" }}
                    >
                      {headline.text}
                    </span>
                    <span
                      className="font-data text-[9px]"
                      style={{ color: "var(--sentinel-text-tertiary)" }}
                    >
                      {headline.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span
              className="text-[10px] italic"
              style={{ color: "var(--sentinel-text-tertiary)" }}
            >
              No intelligence data available.
            </span>
          )}
        </Section>

        {/* Cascade Exposure */}
        {country.exposure && (
          <Section title="CASCADE PRECISION EXPOSURE">
            <div
              className="flex flex-col gap-2 rounded-md p-3"
              style={{
                backgroundColor: riskMutedColor[country.riskLevel],
                border: `1px solid ${riskColor[country.riskLevel]}30`,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--sentinel-text-primary)" }}
                >
                  Total Exposure
                </span>
                <span
                  className="font-data text-lg font-bold"
                  style={{ color: riskColor[country.riskLevel] }}
                >
                  <NumberFlow value={country.exposure.totalExposure} prefix="$" suffix="M" />
                </span>
              </div>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: "var(--sentinel-text-secondary)" }}
              >
                {country.exposure.description}
              </p>
              {country.exposure.affectedFacilities.length > 0 && (
                <div className="flex items-center gap-1">
                  <Factory size={10} style={{ color: "var(--sentinel-text-tertiary)" }} />
                  <span
                    className="font-data text-[9px]"
                    style={{ color: "var(--sentinel-text-tertiary)" }}
                  >
                    {country.exposure.affectedFacilities.join(", ")}
                  </span>
                </div>
              )}
              {country.exposure.affectedRoutes.length > 0 && (
                <div className="flex items-center gap-1">
                  <Route size={10} style={{ color: "var(--sentinel-text-tertiary)" }} />
                  <span
                    className="font-data text-[9px]"
                    style={{ color: "var(--sentinel-text-tertiary)" }}
                  >
                    Routes: {country.exposure.affectedRoutes.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Recommendations */}
        {country.recommendations && country.recommendations.length > 0 && (
          <Section title="RECOMMENDED ACTIONS">
            <div className="flex flex-col gap-2">
              {country.recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} />
              ))}
            </div>
          </Section>
        )}

        {/* Action Panel — navigate to /actions */}
        <ActionPanel countryName={country.name} actionCount={country.recommendations?.length ?? 0} />

        {/* Bottom padding */}
        <div className="h-4 shrink-0" />
      </motion.div>
    </AnimatePresence>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
    >
      <h3
        className="mb-2 font-data text-[9px] font-bold tracking-widest"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const priorityColor: Record<string, string> = {
    IMMEDIATE: "var(--risk-critical)",
    SHORT_TERM: "var(--risk-elevated)",
    MEDIUM_TERM: "var(--risk-moderate)",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex flex-col gap-1.5 rounded-md border p-3"
      style={{
        backgroundColor: "var(--sentinel-bg-elevated)",
        borderColor: "var(--sentinel-border)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-semibold leading-tight"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          {rec.action}
        </span>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 font-data text-[8px] font-bold"
          style={{
            backgroundColor: `${priorityColor[rec.priority]}20`,
            color: priorityColor[rec.priority],
          }}
        >
          {rec.priority.replace("_", " ")}
        </span>
      </div>
      <p
        className="text-[10px] leading-relaxed"
        style={{ color: "var(--sentinel-text-secondary)" }}
      >
        {rec.description}
      </p>
      <div className="flex items-center gap-3 mt-0.5">
        <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          Cost: <strong style={{ color: "var(--sentinel-text-secondary)" }}>{formatMoney(rec.cost)}</strong>
        </span>
        <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          Risk↓: <strong style={{ color: "var(--risk-low)" }}>{formatMoney(rec.riskReduction)}</strong>
        </span>
        <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          ROI: <strong style={{ color: "var(--sentinel-accent)" }}>{rec.roi}x</strong>
        </span>
        <span className="font-data text-[9px]" style={{ color: "var(--sentinel-text-tertiary)" }}>
          {rec.leadTime}
        </span>
      </div>
    </motion.div>
  )
}

function ActionPanel({ countryName, actionCount }: { countryName: string; actionCount: number }) {
  const router = useRouter()

  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: "var(--sentinel-border-subtle)" }}
    >
      <button
        onClick={() => router.navigate({ to: "/actions" })}
        className="flex w-full items-center gap-3 rounded-md border p-3 transition-colors"
        style={{
          backgroundColor: "var(--sentinel-accent-muted)",
          borderColor: "var(--sentinel-accent)30",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--sentinel-accent)18"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--sentinel-accent-muted)"
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: "var(--sentinel-accent)20" }}
        >
          <Zap size={16} style={{ color: "var(--sentinel-accent)" }} />
        </div>
        <div className="flex flex-col items-start gap-0.5 flex-1">
          <span
            className="text-[11px] font-semibold"
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            View Full Mitigation Portfolio
          </span>
          <span
            className="font-data text-[9px]"
            style={{ color: "var(--sentinel-text-tertiary)" }}
          >
            {actionCount} actions for {countryName} — 14 total across all hotspots
          </span>
        </div>
        <ArrowRight size={14} style={{ color: "var(--sentinel-accent)" }} />
      </button>
    </div>
  )
}
