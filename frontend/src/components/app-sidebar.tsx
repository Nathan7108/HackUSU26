import * as React from "react"
import {
  Shield,
  LayoutDashboard,
  List,
  Route,
  Bell,
  TrendingUp,
  FileBarChart,
  Settings2,
  Sparkles,
  Globe,
  Brain,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
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
      logo: Shield,
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
        { title: "Globe View", url: "/dashboard" },
      ],
    },
    {
      title: "Analysis",
      url: "/countries",
      icon: List,
      items: [
        { title: "Country Rankings", url: "/countries" },
        { title: "Exposure Map", url: "/exposure" },
      ],
    },
    {
      title: "Monitoring",
      url: "/alerts",
      icon: Bell,
      items: [
        { title: "Live Alerts", url: "/alerts" },
        { title: "LSTM Forecasts", url: "/forecasts" },
      ],
    },
    {
      title: "Intelligence",
      url: "/reports",
      icon: Brain,
      items: [
        { title: "Model Performance", url: "/reports" },
        { title: "Settings", url: "/settings" },
      ],
    },
  ],
  projects: [
    {
      name: "Supply Chain Risk",
      url: "/exposure",
      icon: Route,
    },
    {
      name: "Forecast Models",
      url: "/forecasts",
      icon: TrendingUp,
    },
    {
      name: "Ask Sentinel",
      url: "#ask-sentinel",
      icon: Sparkles,
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
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
