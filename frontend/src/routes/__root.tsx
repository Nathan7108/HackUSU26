import { createRootRoute, Outlet } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/AppShell"
import { useDemoMode } from "@/hooks/use-demo-mode"

function RootComponent() {
  useDemoMode()
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
