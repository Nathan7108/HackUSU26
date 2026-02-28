import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Theme } from "@/types"

const THEME_ORDER: Theme[] = ["light", "dark", "midnight"]

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      toggleTheme: () => {
        const current = get().theme
        const idx = THEME_ORDER.indexOf(current)
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
        set({ theme: next })
        applyTheme(next)
      },
    }),
    { name: "sentinel-theme" },
  ),
)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove("dark", "midnight")
  if (theme === "dark") {
    root.classList.add("dark")
  } else if (theme === "midnight") {
    root.classList.add("midnight")
  }
}

// Apply theme on load
const stored = localStorage.getItem("sentinel-theme")
if (stored) {
  try {
    const parsed = JSON.parse(stored) as { state: { theme: Theme } }
    applyTheme(parsed.state.theme)
  } catch {
    applyTheme("dark")
  }
}
