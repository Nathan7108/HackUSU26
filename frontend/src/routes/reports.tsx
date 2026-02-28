import { createFileRoute } from "@tanstack/react-router"
import { ReportsPage } from "@/components/pages/ReportsPage"

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
})
