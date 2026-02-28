import { KpiStrip } from "@/components/dashboard/KpiStrip"
import { Watchlist } from "@/components/dashboard/Watchlist"
import { AlertFeed } from "@/components/dashboard/AlertFeed"
import { ExposureSummary } from "@/components/dashboard/ExposureSummary"
import { NewsTicker } from "@/components/dashboard/NewsTicker"
import { GlobeMap } from "@/components/globe/GlobeMap"
import { lazy, Suspense } from "react"
import { useAppStore } from "@/stores/app"
import { useDashboard } from "@/hooks/use-dashboard"

const IntelPanel = lazy(() => import("@/components/intel/IntelPanel").then(m => ({ default: m.IntelPanel })))

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

          {/* Right panel stack — single scrollable column, full height */}
          <div className="w-72 shrink-0 self-stretch overflow-y-auto p-2">
            <div className="flex min-h-full flex-col gap-2">
              <Watchlist countries={dashboard.countries} />
              <ExposureSummary countries={dashboard.countries} />
              <AlertFeed alerts={dashboard.alerts} />
            </div>
          </div>

          {/* Intel slide-in panel */}
          <Suspense fallback={null}>
            {isIntelPanelOpen && <IntelPanel />}
          </Suspense>
        </div>
      </div>

      {/* News ticker — full bleed, sits flush at bottom edge */}
      <div className="shrink-0">
        <NewsTicker countries={dashboard.countries} />
      </div>
    </div>
  )
}
