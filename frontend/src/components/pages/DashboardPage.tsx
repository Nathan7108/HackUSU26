import { KpiStrip } from "@/components/dashboard/KpiStrip"
import { Watchlist } from "@/components/dashboard/Watchlist"
import { AlertFeed } from "@/components/dashboard/AlertFeed"
import { ExposureSummary } from "@/components/dashboard/ExposureSummary"
import { NewsTicker } from "@/components/dashboard/NewsTicker"
import { GlobeMap } from "@/components/globe/GlobeMap"
import { IntelPanel } from "@/components/intel/IntelPanel"
import { getDashboardSummary } from "@/lib/dashboard"
import { useAppStore } from "@/stores/app"

const summary = getDashboardSummary()

export function DashboardPage() {
  const { isIntelPanelOpen } = useAppStore()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* KPI Strip */}
      <KpiStrip kpis={summary.kpis} />

      {/* Main content: Globe + Sidebar panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Globe area */}
        <div className="relative flex-1 overflow-hidden">
          <GlobeMap />
        </div>

        {/* Right panel stack */}
        <div
          className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto border-l p-2"
          style={{
            backgroundColor: "var(--sentinel-bg-base)",
            borderColor: "var(--sentinel-border-subtle)",
          }}
        >
          <Watchlist countries={summary.countries} />
          <ExposureSummary countries={summary.countries} />
          <AlertFeed alerts={summary.alerts} />
        </div>

        {/* Intel slide-in panel */}
        {isIntelPanelOpen && <IntelPanel />}
      </div>

      {/* Bottom news ticker */}
      <NewsTicker countries={summary.countries} />
    </div>
  )
}
