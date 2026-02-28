import { useRef, useCallback } from "react"
import { useAppStore } from "@/stores/app"
import { useDashboard } from "@/hooks/use-dashboard"
import { serializeContext, streamChat, type ChatMessage } from "@/lib/sentinel-ai"

/**
 * Shared chat streaming hook used by both the dropdown and side panel.
 * Throttles store updates to once per animation frame so streaming
 * doesn't cause dozens of re-renders per second.
 */
export function useChatStream() {
  const {
    chatMessages,
    setChatMessages,
    isStreaming,
    setIsStreaming,
    setStreamingText,
    selectedCountryCode,
  } = useAppStore()
  const { dashboard } = useDashboard()

  const accRef = useRef("")
  const rafRef = useRef(0)

  const submitMessage = useCallback(
    (input: string) => {
      if (!input.trim() || isStreaming) return

      setChatMessages((prev) => [...prev, { role: "user", content: input }])
      setIsStreaming(true)
      setStreamingText("")
      accRef.current = ""

      const history: ChatMessage[] = [
        ...chatMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: input },
      ]

      const context = serializeContext(dashboard, selectedCountryCode)

      streamChat(
        history,
        context,
        // onChunk — accumulate in ref, flush at most once per frame
        (chunk) => {
          accRef.current += chunk
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              setStreamingText(accRef.current)
              rafRef.current = 0
            })
          }
        },
        // onDone
        () => {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = 0
          setChatMessages((prev) => [...prev, { role: "assistant", content: accRef.current }])
          setStreamingText("")
          setIsStreaming(false)
        },
        // onError
        (err) => {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = 0
          console.error("Sentinel AI error:", err)
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${err.message}` },
          ])
          setStreamingText("")
          setIsStreaming(false)
        },
      )
    },
    [chatMessages, isStreaming, dashboard, selectedCountryCode, setChatMessages, setIsStreaming, setStreamingText],
  )

  return { submitMessage }
}
