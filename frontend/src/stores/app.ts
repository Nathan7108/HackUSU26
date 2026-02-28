import { create } from "zustand"
import type { Country } from "@/types"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface AppStore {
  // Selected country (drives globe + intel panel)
  selectedCountryCode: string | null
  selectCountry: (code: string | null) => void

  // Intel panel
  isIntelPanelOpen: boolean
  setIntelPanelOpen: (open: boolean) => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Demo mode (keyboard shortcuts active)
  isDemoMode: boolean
  setDemoMode: (active: boolean) => void

  // Command palette (AI chat)
  isCommandOpen: boolean
  setCommandOpen: (open: boolean) => void

  // Chat messages (persist across open/close)
  chatMessages: ChatMessage[]
  setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  clearChat: () => void
}

export const useAppStore = create<AppStore>()((set, get) => ({
  selectedCountryCode: null,
  selectCountry: (code) => {
    const current = get().selectedCountryCode
    if (code === current) {
      set({ selectedCountryCode: null, isIntelPanelOpen: false })
    } else {
      set({ selectedCountryCode: code, isIntelPanelOpen: code !== null })
    }
  },

  isIntelPanelOpen: false,
  setIntelPanelOpen: (open) =>
    set({ isIntelPanelOpen: open, selectedCountryCode: open ? get().selectedCountryCode : null }),

  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  isDemoMode: false,
  setDemoMode: (active) => set({ isDemoMode: active }),

  isCommandOpen: false,
  setCommandOpen: (open) => set({ isCommandOpen: open }),

  chatMessages: [],
  setChatMessages: (msgs) =>
    set((state) => ({
      chatMessages: typeof msgs === "function" ? msgs(state.chatMessages) : msgs,
    })),
  clearChat: () => set({ chatMessages: [] }),
}))
