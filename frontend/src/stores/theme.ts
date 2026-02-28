import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Theme } from "@/types"

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
        const next = get().theme === "dark" ? "light" : "dark"
        set({ theme: next })
        applyTheme(next)
      },
    }),
    { name: "sentinel-theme" },
  ),
)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
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
