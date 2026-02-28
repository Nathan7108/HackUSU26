import { createFileRoute } from "@tanstack/react-router"
import { ForecastsPage } from "@/components/pages/ForecastsPage"

export const Route = createFileRoute("/forecasts")({
  component: ForecastsPage,
})
