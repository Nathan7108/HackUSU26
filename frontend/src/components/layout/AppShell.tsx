import type { ReactNode } from "react"
import { useMatches } from "@tanstack/react-router"
import { AnimatePresence } from "motion/react"
import { AppSidebar } from "@/components/app-sidebar"
import { DataStatusBadge } from "@/components/layout/DataStatusBadge"
import { SentinelSearchBar } from "@/components/sentinel/SentinelSearchBar"
import { SentinelChatPanel } from "@/components/sentinel/SentinelChatPanel"
import { useAppStore } from "@/stores/app"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const routeMeta: Record<string, { section: string; page: string }> = {
  "/dashboard": { section: "Sentinel AI", page: "Dashboard" },
  "/countries": { section: "Analysis", page: "Country Rankings" },
  "/actions": { section: "Analysis", page: "Recommended Actions" },
  "/forecasts": { section: "Predictions", page: "LSTM Forecasts" },
  "/reports": { section: "Intelligence", page: "Model Performance" },
  "/settings": { section: "System", page: "Settings" },
}

function getSidebarCookie(): boolean {
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(\w+)/)
  return match ? match[1] === "true" : true
}

export function AppShell({ children }: { children: ReactNode }) {
  const isChatPanelOpen = useAppStore((s) => s.isChatPanelOpen)
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.fullPath ?? "/dashboard"
  const isCountryDetail = currentPath.startsWith("/country/")
  const meta = isCountryDetail
    ? { section: "Analysis", page: "Country Detail" }
    : routeMeta[currentPath] ?? { section: "Sentinel AI", page: "Dashboard" }

  return (
    <SidebarProvider defaultOpen={getSidebarCookie()}>
      <AppSidebar />
      <SidebarInset className="min-w-0 h-svh flex flex-col overflow-hidden">
        <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-sidebar transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          {/* Left: sidebar trigger + breadcrumb */}
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    {meta.section}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{meta.page}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Center: Sentinel AI search bar */}
          <div className="flex flex-1 justify-center px-4">
            <SentinelSearchBar />
          </div>

          {/* Right: status badge */}
          <div className="flex items-center gap-2 px-4">
            <DataStatusBadge />
          </div>
        </header>
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <AnimatePresence>
            {isChatPanelOpen && <SentinelChatPanel />}
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
