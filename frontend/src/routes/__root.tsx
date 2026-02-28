import { createRootRoute, Outlet } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/AppShell"
import { CommandPalette } from "@/components/sentinel/CommandPalette"

export const Route = createRootRoute({
  component: () => (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <CommandPalette />
    </>
  ),
})
