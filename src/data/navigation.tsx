import {
  Layout,
  Lightning,
  Lightbulb,
  ClockCounterClockwise,
  CheckSquare,
  BookOpenText,
  UserCircle,
  Briefcase,
  ChartBar,
  UsersThree,
  Envelope,
  FileText,
  Gear,
} from "@phosphor-icons/react"

import type { ReactNode } from "react"

import type { Portal, ScreenId } from "@/types/app"

export interface NavItem {
  icon: ReactNode

  label: string

  screen: ScreenId
}

export const seekerNavItems: NavItem[] = [
  {
    icon: <FileText size={18} weight="light" />,

    label: "CV Rebuild",

    screen: "cv-rebuild",
  },

  {
    icon: <Lightning size={18} weight="light" />,

    label: "Match Analyzer",

    screen: "analyzer",
  },

  {
    icon: <Lightbulb size={18} weight="light" />,

    label: "Improvement Tips",

    screen: "improvement",
  },

  {
    icon: <ClockCounterClockwise size={18} weight="light" />,

    label: "CV History",

    screen: "cv-history",
  },

  {
    icon: <CheckSquare size={18} weight="light" />,

    label: "Application Tracker",

    screen: "app-tracker",
  },

  {
    icon: <BookOpenText size={18} weight="light" />,

    label: "JD Library",

    screen: "jd-library",
  },

  {
    icon: <UserCircle size={18} weight="light" />,

    label: "Profile",

    screen: "profile",
  },
]

export const hrNavItems: NavItem[] = [
  {
    icon: <Layout size={18} weight="light" />,

    label: "Dashboard",

    screen: "hr-dashboard",
  },

  {
    icon: <Briefcase size={18} weight="light" />,

    label: "Job Posts",

    screen: "job-posts",
  },

  {
    icon: <FileText size={18} weight="light" />,

    label: "CV Ranking",

    screen: "cv-ranking",
  },

  {
    icon: <UsersThree size={18} weight="light" />,

    label: "Pipeline",

    screen: "pipeline",
  },

  {
    icon: <Envelope size={18} weight="light" />,

    label: "Auto Email",

    screen: "auto-email",
  },

  {
    icon: <ChartBar size={18} weight="light" />,

    label: "Reports",

    screen: "reports",
  },

  {
    icon: <Gear size={18} weight="light" />,

    label: "Settings",

    screen: "hr-settings",
  },
]

export function getPortalNavigation(portal: Portal) {
  return portal === "seeker" ? seekerNavItems : hrNavItems
}
