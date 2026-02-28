import { create } from "zustand"
import type { Map as MapboxMap } from "mapbox-gl"

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

  // Chat panel (expanded AI chat)
  isChatPanelOpen: boolean
  setChatPanelOpen: (open: boolean) => void

  // Chat messages (persist across open/close)
  chatMessages: ChatMessage[]
  setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  clearChat: () => void

  // Streaming state (shared between dropdown + panel)
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  streamingText: string
  setStreamingText: (v: string) => void

  // Global map reference (set by GlobeMap, read by demo shortcuts)
  mapInstance: MapboxMap | null
  setMapInstance: (map: MapboxMap | null) => void
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

  isDemoMode: true,
  setDemoMode: (active) => set({ isDemoMode: active }),

  isCommandOpen: false,
  setCommandOpen: (open) => set({ isCommandOpen: open }),

  isChatPanelOpen: false,
  setChatPanelOpen: (open) =>
    set({ isChatPanelOpen: open, ...(open ? { isCommandOpen: false } : {}) }),

  chatMessages: [],
  setChatMessages: (msgs) =>
    set((state) => ({
      chatMessages: typeof msgs === "function" ? msgs(state.chatMessages) : msgs,
    })),
  clearChat: () => set({ chatMessages: [], streamingText: "", isStreaming: false }),

  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),
  streamingText: "",
  setStreamingText: (v) => set({ streamingText: v }),

  mapInstance: null,
  setMapInstance: (map) => set({ mapInstance: map }),
}))
