import { useParams, useRouter } from "@tanstack/react-router"
import { getCountryByCode } from "@/data"
import { IntelPanel } from "@/components/intel/IntelPanel"
import { GlobeMap } from "@/components/globe/GlobeMap"
import { useAppStore } from "@/stores/app"
import { useEffect } from "react"
import { ArrowLeft } from "lucide-react"

export function CountryDetailPage() {
  const { code } = useParams({ from: "/country/$code" })
  const router = useRouter()
  const { selectCountry } = useAppStore()
  const country = getCountryByCode(code)

  // Auto-select country on mount
  useEffect(() => {
    if (code) {
      selectCountry(code)
    }
  }, [code, selectCountry])

  if (!country) {
    return (
      <div className="flex h-full items-center justify-center">
        <span style={{ color: "var(--sentinel-text-tertiary)" }}>
          Country not found: {code}
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl">
      {/* Left: Globe focused on country */}
      <div className="relative flex-1">
        <GlobeMap />

        {/* Back button */}
        <button
          onClick={() => router.navigate({ to: "/countries" })}
          className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors"
          style={{
            backgroundColor: "var(--sentinel-bg-surface)",
            border: "1px solid var(--sentinel-border-subtle)",
            color: "var(--sentinel-text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--sentinel-bg-elevated)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--sentinel-bg-surface)"
          }}
        >
          <ArrowLeft size={13} />
          Back to Rankings
        </button>
      </div>

      {/* Right: Intel Panel */}
      <IntelPanel />
    </div>
  )
}
