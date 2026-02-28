import { createFileRoute } from "@tanstack/react-router"
import { CountryDetailPage } from "@/components/pages/CountryDetailPage"

export const Route = createFileRoute("/country/$code")({
  component: CountryDetailPage,
})
