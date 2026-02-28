import { useThemeStore } from "@/stores/theme"
import { Moon, Sun, Shield, Bell, Globe, Cpu } from "lucide-react"

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {/* Header */}
      <div className="flex flex-col mb-6">
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--sentinel-text-primary)" }}
        >
          Settings
        </h1>
        <span
          className="font-data text-[10px]"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          SENTINEL AI — CONFIGURATION
        </span>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Theme */}
        <SettingsSection title="APPEARANCE" icon={Sun}>
          <div className="flex gap-2">
            <ThemeOption
              label="Light"
              icon={Sun}
              active={theme === "light"}
              onClick={() => setTheme("light")}
            />
            <ThemeOption
              label="Dark"
              icon={Moon}
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
            />
          </div>
        </SettingsSection>

        {/* API */}
        <SettingsSection title="API CONNECTION" icon={Globe}>
          <div className="flex flex-col gap-2">
            <SettingsRow label="Backend URL" value="http://localhost:8000" />
            <SettingsRow label="Status" value="Connected" valueColor="var(--risk-low)" />
            <SettingsRow label="Refresh Interval" value="15 min" />
            <SettingsRow label="Cache TTL" value="60 min" />
          </div>
        </SettingsSection>

        {/* ML */}
        <SettingsSection title="ML MODELS" icon={Cpu}>
          <div className="flex flex-col gap-2">
            <SettingsRow label="Risk Scorer" value="XGBoost v2.0.3" valueColor="var(--risk-low)" />
            <SettingsRow label="Anomaly Detection" value="Isolation Forest" valueColor="var(--risk-low)" />
            <SettingsRow label="Sentiment" value="ProsusAI/FinBERT" valueColor="var(--risk-low)" />
            <SettingsRow label="Forecaster" value="LSTM + Attention" valueColor="var(--risk-low)" />
            <SettingsRow label="Intelligence" value="GPT-4o" valueColor="var(--risk-low)" />
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="ALERTS & NOTIFICATIONS" icon={Bell}>
          <div className="flex flex-col gap-2">
            <SettingsRow label="Critical Alerts" value="Enabled" valueColor="var(--risk-low)" />
            <SettingsRow label="Anomaly Notifications" value="Enabled" valueColor="var(--risk-low)" />
            <SettingsRow label="Forecast Shifts" value="Enabled" valueColor="var(--risk-low)" />
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="ABOUT" icon={Shield}>
          <div className="flex flex-col gap-2">
            <SettingsRow label="Product" value="Sentinel AI" />
            <SettingsRow label="Version" value="2.4.1" />
            <SettingsRow label="License" value="Enterprise" />
            <SettingsRow label="Customer" value="Cascade Precision Industries" />
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}

function SettingsSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Sun
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col rounded-md border"
      style={{
        backgroundColor: "var(--sentinel-bg-surface)",
        borderColor: "var(--sentinel-border-subtle)",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: "var(--sentinel-border-subtle)" }}
      >
        <Icon size={14} style={{ color: "var(--sentinel-text-tertiary)" }} />
        <span
          className="font-data text-[10px] font-bold tracking-widest"
          style={{ color: "var(--sentinel-text-tertiary)" }}
        >
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SettingsRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--sentinel-text-secondary)" }}>
        {label}
      </span>
      <span
        className="font-data text-xs font-medium"
        style={{ color: valueColor ?? "var(--sentinel-text-primary)" }}
      >
        {value}
      </span>
    </div>
  )
}

function ThemeOption({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: typeof Sun
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border px-4 py-2.5 transition-colors"
      style={{
        backgroundColor: active ? "var(--sentinel-accent-muted)" : "var(--sentinel-bg-elevated)",
        borderColor: active ? "var(--sentinel-accent)" : "var(--sentinel-border)",
        color: active ? "var(--sentinel-accent)" : "var(--sentinel-text-secondary)",
      }}
    >
      <Icon size={16} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
