import { memo } from "react"

/**
 * Lightweight markdown renderer for Sentinel AI chat.
 * Handles: headings, bullets, numbered lists, bold, inline code, blank lines.
 * No external dependencies. Wrapped in React.memo to skip re-renders when text is unchanged.
 */

// ── Inline formatting ────────────────────────────────────────────

function renderInline(text: string) {
  // Split on **bold** and `code` patterns
  const parts: React.ReactNode[] = []
  // Regex matches **bold** or `code` segments
  const regex = /\*\*(.*?)\*\*|`(.*?)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Push text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      // **bold**
      parts.push(
        <strong key={match.index} style={{ color: "var(--sentinel-text-primary)", fontWeight: 600 }}>
          {match[1]}
        </strong>,
      )
    } else if (match[2] !== undefined) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="rounded px-1 py-0.5 font-data text-[12px]"
          style={{
            backgroundColor: "var(--sentinel-bg-overlay)",
            color: "var(--sentinel-accent)",
          }}
        >
          {match[2]}
        </code>,
      )
    }
    lastIndex = match.index + match[0].length
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

// ── Line classification ──────────────────────────────────────────

interface ParsedLine {
  type: "heading" | "bullet" | "numbered" | "blank" | "text"
  content: string
  level?: number // heading level (1-3) or list nesting
  number?: number // for numbered lists
}

function parseLine(raw: string): ParsedLine {
  if (raw.trim() === "") return { type: "blank", content: "" }

  // Headings: ### text, ## text, # text
  const headingMatch = raw.match(/^(#{1,3})\s+(.+)$/)
  if (headingMatch) {
    return { type: "heading", content: headingMatch[2], level: headingMatch[1].length }
  }

  // Bullet: - text or * text (with optional leading spaces)
  const bulletMatch = raw.match(/^(\s*)[-*]\s+(.+)$/)
  if (bulletMatch) {
    return { type: "bullet", content: bulletMatch[2] }
  }

  // Numbered: 1. text (with optional leading spaces)
  const numberedMatch = raw.match(/^(\s*)(\d+)\.\s+(.+)$/)
  if (numberedMatch) {
    return { type: "numbered", content: numberedMatch[3], number: parseInt(numberedMatch[2]) }
  }

  return { type: "text", content: raw }
}

// ── Render ───────────────────────────────────────────────────────

export const RenderMarkdown = memo(function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const parsed = parseLine(lines[i])

    switch (parsed.type) {
      case "blank":
        elements.push(<div key={i} className="h-2" />)
        i++
        break

      case "heading":
        elements.push(
          <div
            key={i}
            className={
              parsed.level === 1
                ? "mt-3 mb-1.5 text-[14px] font-semibold"
                : parsed.level === 2
                  ? "mt-2.5 mb-1 text-[13px] font-semibold"
                  : "mt-2 mb-1 text-[13px] font-medium"
            }
            style={{ color: "var(--sentinel-text-primary)" }}
          >
            {renderInline(parsed.content)}
          </div>,
        )
        i++
        break

      case "bullet": {
        // Collect consecutive bullets into a list
        const items: ParsedLine[] = []
        while (i < lines.length) {
          const p = parseLine(lines[i])
          if (p.type === "bullet") {
            items.push(p)
            i++
          } else break
        }
        elements.push(
          <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-3.5">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--sentinel-text-tertiary)" }}
                />
                <span>{renderInline(item.content)}</span>
              </li>
            ))}
          </ul>,
        )
        break
      }

      case "numbered": {
        // Collect consecutive numbered items
        const items: ParsedLine[] = []
        while (i < lines.length) {
          const p = parseLine(lines[i])
          if (p.type === "numbered") {
            items.push(p)
            i++
          } else break
        }
        elements.push(
          <ol key={`ol-${i}`} className="my-1 space-y-0.5 pl-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span
                  className="shrink-0 font-data text-[11px] font-medium tabular-nums"
                  style={{ color: "var(--sentinel-accent)", minWidth: "16px", textAlign: "right" }}
                >
                  {item.number ?? idx + 1}.
                </span>
                <span>{renderInline(item.content)}</span>
              </li>
            ))}
          </ol>,
        )
        break
      }

      default:
        elements.push(<div key={i}>{renderInline(parsed.content)}</div>)
        i++
        break
    }
  }

  return <>{elements}</>
})
