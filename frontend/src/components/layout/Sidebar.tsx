import { useRouter, useMatches } from "@tanstack/react-router"
import {
  Globe,
  LayoutDashboard,
  List,
  Route,
  Bell,
  TrendingUp,
  FileBarChart,
  Settings,
  Sun,
  Moon,
} from "lucide-react"
import { useThemeStore } from "@/stores/theme"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/countries", icon: List, label: "Countries" },
  { to: "/exposure", icon: Route, label: "Exposure" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/forecasts", icon: TrendingUp, label: "Forecasts" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const

export function Sidebar() {
  const router = useRouter()
  const matches = useMatches()
  const { theme, toggleTheme } = useThemeStore()
  const currentPath = matches[matches.length - 1]?.fullPath ?? ""

  return (
    <nav
      className="flex h-full w-14 flex-col items-center border-r py-3"
      style={{
        backgroundColor: "var(--sentinel-bg-muted)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      {/* Logo */}
      <button
        onClick={() => router.navigate({ to: "/dashboard" })}
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-md transition-colors"
        style={{ color: "var(--sentinel-accent)" }}
        title="Sentinel AI"
      >
        <svg viewBox="0 0 32 32" fill="none" width={22} height={22}>
          <path
            d="M16 2L4 8v8.5C4 24.3 9.4 30 16 31.5 22.6 30 28 24.3 28 16.5V8L16 2Z"
            fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round"
          />
          <path d="M9 16c2-3.8 4.5-5.2 7-5.2s5 1.4 7 5.2" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
          <path d="M9 16c2 3.8 4.5 5.2 7 5.2s5-1.4 7-5.2" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={16} cy={16} r={2.3} fill="currentColor" />
          <circle cx={16} cy={16} r={4} stroke="currentColor" strokeWidth={0.7} strokeOpacity={0.35} />
        </svg>
      </button>

      {/* Globe shortcut */}
      <NavButton
        icon={Globe}
        label="Globe"
        isActive={currentPath === "/dashboard"}
        onClick={() => router.navigate({ to: "/dashboard" })}
      />

      <div
        className="mx-auto my-2 w-6"
        style={{ borderTop: "1px solid var(--sentinel-border-subtle)" }}
      />

      {/* Nav items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ to, icon, label }) => (
          <NavButton
            key={to}
            icon={icon}
            label={label}
            isActive={currentPath.startsWith(to)}
            onClick={() => router.navigate({ to })}
          />
        ))}
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="mt-auto flex h-9 w-9 items-center justify-center rounded-md transition-colors"
        style={{ color: "var(--sentinel-text-tertiary)" }}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  )
}

function NavButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: typeof LayoutDashboard
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md transition-all duration-150",
      )}
      style={{
        backgroundColor: isActive ? "var(--sentinel-accent-muted)" : "transparent",
        color: isActive ? "var(--sentinel-accent)" : "var(--sentinel-text-tertiary)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--sentinel-bg-overlay)"
          e.currentTarget.style.color = "var(--sentinel-text-secondary)"
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent"
          e.currentTarget.style.color = "var(--sentinel-text-tertiary)"
        }
      }}
    >
      <Icon size={18} />
    </button>
  )
}
