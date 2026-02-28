import { createFileRoute } from "@tanstack/react-router"
import { ActionsPage } from "@/components/pages/ActionsPage"

export const Route = createFileRoute("/actions")({
  component: ActionsPage,
})
