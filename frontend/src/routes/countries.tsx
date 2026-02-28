import { createFileRoute } from "@tanstack/react-router"
import { CountriesPage } from "@/components/pages/CountriesPage"

export const Route = createFileRoute("/countries")({
  component: CountriesPage,
})
