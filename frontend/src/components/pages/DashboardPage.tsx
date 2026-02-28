import { KpiStrip } from "@/components/dashboard/KpiStrip"
import { Watchlist } from "@/components/dashboard/Watchlist"
import { AlertFeed } from "@/components/dashboard/AlertFeed"
import { ExposureSummary } from "@/components/dashboard/ExposureSummary"
import { NewsTicker } from "@/components/dashboard/NewsTicker"
import { GlobeMap } from "@/components/globe/GlobeMap"
import { IntelPanel } from "@/components/intel/IntelPanel"
import { useAppStore } from "@/stores/app"
import { useDashboard } from "@/hooks/use-dashboard"

export function DashboardPage() {
  const { isIntelPanelOpen } = useAppStore()
  const { dashboard, isLive } = useDashboard()

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Padded content area */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2 overflow-hidden">
        {/* KPI Strip — full width top row */}
        <div className="pb-2">
          <KpiStrip kpis={dashboard.kpis} />
        </div>

        {/* Main content: Globe + Sidebar panels */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl">
          {/* Globe area */}
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl">
            <GlobeMap />
          </div>

          {/* Right panel stack */}
          <div className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto p-2">
            <Watchlist countries={dashboard.countries} />
            <ExposureSummary countries={dashboard.countries} />
            <AlertFeed alerts={dashboard.alerts} />
          </div>

          {/* Intel slide-in panel */}
          {isIntelPanelOpen && <IntelPanel />}
        </div>
      </div>

      {/* News ticker — full bleed, sits flush at bottom edge */}
      <div className="shrink-0">
        <NewsTicker countries={dashboard.countries} />
      </div>
    </div>
  )
}
