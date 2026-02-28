import type { RiskLevel, Trend } from "@/types"

export const riskColor: Record<RiskLevel, string> = {
  CRITICAL: "var(--risk-critical)",
  HIGH: "var(--risk-high)",
  ELEVATED: "var(--risk-elevated)",
  MODERATE: "var(--risk-moderate)",
  LOW: "var(--risk-low)",
}

export const riskMutedColor: Record<RiskLevel, string> = {
  CRITICAL: "var(--risk-critical-muted)",
  HIGH: "var(--risk-high-muted)",
  ELEVATED: "var(--risk-elevated-muted)",
  MODERATE: "var(--risk-moderate-muted)",
  LOW: "var(--risk-low-muted)",
}

export const riskOrder: Record<RiskLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  ELEVATED: 2,
  MODERATE: 1,
  LOW: 0,
}

export const trendIcon: Record<Trend, string> = {
  ESCALATING: "↑",
  STABLE: "→",
  "DE-ESCALATING": "↓",
}

export const trendColor: Record<Trend, string> = {
  ESCALATING: "var(--risk-critical)",
  STABLE: "var(--sentinel-text-tertiary)",
  "DE-ESCALATING": "var(--risk-low)",
}

export function formatMoney(millions: number): string {
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`
  return `$${millions}M`
}

export function formatScore(score: number): string {
  return score.toFixed(0)
}

export function timeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
