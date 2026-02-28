import { useThemeStore } from "@/stores/theme"

export default function App() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--sentinel-bg-base)" }}>
      <div className="text-center">
        <h1
          className="mb-4 text-2xl font-bold"
          style={{ color: "var(--sentinel-text-primary)", fontFamily: "var(--font-mono)" }}
        >
          SENTINEL AI
        </h1>
        <p className="mb-6" style={{ color: "var(--sentinel-text-secondary)" }}>
          Geopolitical Intelligence Platform
        </p>
        <button
          onClick={toggleTheme}
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--sentinel-bg-elevated)",
            color: "var(--sentinel-text-primary)",
            border: "1px solid var(--sentinel-border)",
          }}
        >
          Theme: {theme}
        </button>
      </div>
    </div>
  )
}
