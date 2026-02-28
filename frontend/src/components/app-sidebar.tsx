import * as React from "react"
import {
  LayoutDashboard,
  List,
  Bell,
  Globe,
  Brain,
} from "lucide-react"

function SentinelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 2L4 8v8.5C4 24.3 9.4 30 16 31.5 22.6 30 28 24.3 28 16.5V8L16 2Z"
        fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round"
      />
      <path d="M9 16c2-3.8 4.5-5.2 7-5.2s5 1.4 7 5.2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M9 16c2 3.8 4.5 5.2 7 5.2s5-1.4 7-5.2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={16} cy={16} r={2.3} fill="currentColor" />
    </svg>
  )
}

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Cascade Precision",
    email: "ops@cascadeprecision.com",
    avatar: "",
  },
  teams: [
    {
      name: "Sentinel AI",
      logo: SentinelIcon,
      plan: "Enterprise",
    },
    {
      name: "Cascade Precision",
      logo: Globe,
      plan: "Client Portal",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
      items: [
        { title: "Overview", url: "/dashboard" },
      ],
    },
    {
      title: "Analysis",
      url: "/countries",
      icon: List,
      items: [
        { title: "Country Rankings", url: "/countries" },
        { title: "Actions", url: "/actions" },
      ],
    },
    {
      title: "Monitoring",
      url: "/forecasts",
      icon: Bell,
      items: [
        { title: "LSTM Forecasts", url: "/forecasts" },
      ],
    },
    {
      title: "Intelligence",
      url: "/reports",
      icon: Brain,
      items: [
        { title: "Model Performance", url: "/reports" },
        { title: "Ask Sentinel", url: "#ask-sentinel" },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
