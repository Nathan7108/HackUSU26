import { create } from "zustand"
import type { Theme } from "@/types"

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: "midnight" as Theme,
  setTheme: () => {},
  toggleTheme: () => {},
}))

// Always midnight — force on load
document.documentElement.classList.remove("dark")
document.documentElement.classList.add("midnight")
