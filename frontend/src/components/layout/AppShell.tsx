import type { ReactNode } from "react"
import { useMatches } from "@tanstack/react-router"
import { Sun, Moon, Eclipse } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { DataStatusBadge } from "@/components/layout/DataStatusBadge"
import { SentinelSearchBar } from "@/components/sentinel/SentinelSearchBar"
import { useThemeStore } from "@/stores/theme"
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
  "/exposure": { section: "Supply Chain", page: "Exposure Map" },
  "/actions": { section: "Analysis", page: "Recommended Actions" },
  "/alerts": { section: "Monitoring", page: "Live Alerts" },
  "/forecasts": { section: "Predictions", page: "LSTM Forecasts" },
  "/reports": { section: "Intelligence", page: "Model Performance" },
  "/settings": { section: "System", page: "Settings" },
}

function getSidebarCookie(): boolean {
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(\w+)/)
  return match ? match[1] === "true" : true
}

export function AppShell({ children }: { children: ReactNode }) {
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

          {/* Right: theme toggle + status badge */}
          <div className="flex items-center gap-2 px-4">
            <ThemeToggle />
            <DataStatusBadge />
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

const themeIcon = { light: Moon, dark: Eclipse, midnight: Sun } as const
const themeLabel = { light: "Slate", dark: "Midnight", midnight: "Light" } as const

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  const Icon = themeIcon[theme]

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 h-8 rounded-md border px-2.5 transition-colors"
      style={{
        backgroundColor: "var(--sentinel-bg-elevated)",
        borderColor: "var(--sentinel-border-subtle)",
        color: "var(--sentinel-text-secondary)",
      }}
      title={`Switch to ${themeLabel[theme]}`}
    >
      <Icon size={14} />
      <span className="font-data text-[10px] font-semibold uppercase tracking-wider">
        {theme}
      </span>
    </button>
  )
}
