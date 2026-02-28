import { useDashboard } from "@/hooks/use-dashboard"

export function DataStatusBadge() {
  const { isLive, isLoading } = useDashboard()

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-data text-[10px] font-bold tracking-wider"
        style={{
          backgroundColor: "rgba(148,163,184,0.12)",
          color: "var(--sentinel-text-tertiary)",
          border: "1px solid rgba(148,163,184,0.25)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--sentinel-text-tertiary)" }}
        />
        CONNECTING
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-data text-[10px] font-bold tracking-wider"
      style={{
        backgroundColor: isLive ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.12)",
        color: isLive ? "var(--risk-low)" : "var(--risk-elevated)",
        border: `1px solid ${isLive ? "rgba(34,197,94,0.25)" : "rgba(234,179,8,0.25)"}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: isLive ? "var(--risk-low)" : "var(--risk-elevated)",
          animation: isLive ? "pulse 2s infinite" : "none",
        }}
      />
      {isLive ? "LIVE" : "MOCK DATA"}
    </div>
  )
}
