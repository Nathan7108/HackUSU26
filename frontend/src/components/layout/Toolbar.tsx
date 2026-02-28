import { Search, Command } from "lucide-react"
import { useAppStore } from "@/stores/app"

export function Toolbar() {
  const { searchQuery, setSearchQuery, setCommandOpen } = useAppStore()

  return (
    <header
      className="flex h-11 shrink-0 items-center gap-4 border-b px-4"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      {/* Branding */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold tracking-wider"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          CASCADE PRECISION INDUSTRIES
        </span>
        <span style={{ color: "var(--sentinel-border)" }}>|</span>
        <span
          className="font-data text-xs font-bold tracking-wide"
          style={{ color: "var(--sentinel-accent)" }}
        >
          SENTINEL
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div
        className="flex h-7 w-52 items-center gap-2 rounded-md px-2"
        style={{
          backgroundColor: "var(--sentinel-bg-elevated)",
          border: "1px solid var(--sentinel-border)",
        }}
      >
        <Search size={13} style={{ color: "var(--sentinel-text-tertiary)" }} />
        <input
          type="text"
          placeholder="Search countries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
          style={{ color: "var(--sentinel-text-primary)" }}
        />
      </div>

      {/* Command palette trigger */}
      <button
        onClick={() => setCommandOpen(true)}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors"
        style={{
          backgroundColor: "var(--sentinel-bg-elevated)",
          border: "1px solid var(--sentinel-border)",
          color: "var(--sentinel-text-tertiary)",
        }}
        title="Ask Sentinel (⌘K)"
      >
        <Command size={12} />
        <span>Ask Sentinel</span>
        <kbd
          className="ml-1 rounded px-1 font-data text-[10px]"
          style={{
            backgroundColor: "var(--sentinel-bg-overlay)",
            color: "var(--sentinel-text-tertiary)",
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Version */}
      <span
        className="font-data text-[10px]"
        style={{ color: "var(--sentinel-text-tertiary)" }}
      >
        v2.4.1
      </span>
    </header>
  )
}
