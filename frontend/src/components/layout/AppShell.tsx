import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Toolbar } from "./Toolbar"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ backgroundColor: "var(--sentinel-bg-base)" }}
    >
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top toolbar */}
        <Toolbar />

        {/* Page content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
