import { createFileRoute } from "@tanstack/react-router"
import { ExposurePage } from "@/components/pages/ExposurePage"

export const Route = createFileRoute("/exposure")({
  component: ExposurePage,
})
