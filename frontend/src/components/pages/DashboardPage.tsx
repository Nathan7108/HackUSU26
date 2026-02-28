import { KpiStrip } from "@/components/dashboard/KpiStrip"
import { Watchlist } from "@/components/dashboard/Watchlist"
import { AlertFeed } from "@/components/dashboard/AlertFeed"
import { ExposureSummary } from "@/components/dashboard/ExposureSummary"
import { NewsTicker } from "@/components/dashboard/NewsTicker"
import { GlobeMap } from "@/components/globe/GlobeMap"
import { useState } from "react"
import { useAppStore } from "@/stores/app"
import { useDashboard } from "@/hooks/use-dashboard"
import { Loader2 } from "lucide-react"
import { IntelPanel } from "@/components/intel/IntelPanel"

export function DashboardPage() {
  const { isIntelPanelOpen } = useAppStore()
  const { dashboard, isLoading, error } = useDashboard()
  const [, setMapReady] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--sentinel-text-tertiary)" }} />
          <span className="font-data text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>
            Connecting to Sentinel backend...
          </span>
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-lg font-semibold" style={{ color: "var(--sentinel-text-primary)" }}>
            Backend Unavailable
          </span>
          <span className="text-sm" style={{ color: "var(--sentinel-text-secondary)" }}>
            {error?.message ?? "Unable to connect to the Sentinel API. Ensure the backend is running."}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Padded content area */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-4 overflow-hidden">
        {/* KPI Strip — full width top row */}
        <div className="pb-2">
          <KpiStrip kpis={dashboard.kpis} />
        </div>

        {/* Main content: Globe + Sidebar panels */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl">
          {/* Globe area — capped so panels stay visible on ultrawide */}
          <div className="relative min-w-0 flex-1 max-w-[65%] overflow-hidden rounded-xl">
            <GlobeMap onMapReady={() => { setMapReady(true) }} />
          </div>

          {/* Right panel stack — wider on large screens */}
          <div className="w-72 2xl:w-80 shrink-0 flex-1 min-w-72 max-w-96 self-stretch overflow-y-auto p-2">
            <div className="flex min-h-full flex-col gap-2">
              <Watchlist countries={dashboard.countries} />
              <ExposureSummary />
              <AlertFeed alerts={dashboard.alerts} />
            </div>
          </div>

          {/* Intel panel — flex sibling, pushes watchlist + globe when open */}
          {isIntelPanelOpen && <IntelPanel />}
        </div>
      </div>

      {/* News ticker — full bleed, sits flush at bottom edge */}
      <div className="shrink-0">
        <NewsTicker />
      </div>
    </div>
  )
}
