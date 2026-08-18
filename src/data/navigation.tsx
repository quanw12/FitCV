import type { ReactNode } from "react"

import documentText from "@/imports/navigation-icons/document-text.svg"

import magnifyingGlass from "@/imports/navigation-icons/magnifying-glass.svg"

import lightBulb from "@/imports/navigation-icons/light-bulb.svg"

import clock from "@/imports/navigation-icons/clock.svg"

import clipboardCheck from "@/imports/navigation-icons/clipboard-document-check.svg"

import bookOpen from "@/imports/navigation-icons/book-open.svg"

import userCircle from "@/imports/navigation-icons/user-circle.svg"

import briefcase from "@/imports/navigation-icons/briefcase.svg"

import users from "@/imports/navigation-icons/users.svg"

import funnel from "@/imports/navigation-icons/funnel.svg"

import envelope from "@/imports/navigation-icons/envelope.svg"

import chartBar from "@/imports/navigation-icons/chart-bar-square.svg"

import cog from "@/imports/navigation-icons/cog-6-tooth.svg"

import type { Portal, ScreenId } from "@/types/app"

export interface NavItem {
  icon: ReactNode

  label: string

  screen: ScreenId
}

const icon = (src: string) => (
  <img className="fc-nav-svg" src={src} alt="" aria-hidden="true" />
)

export const seekerNavItems: NavItem[] = [
  { icon: icon(documentText), label: "CV Build", screen: "cv-rebuild" },
  { icon: icon(magnifyingGlass), label: "Match Analyzer", screen: "analyzer" },
  { icon: icon(lightBulb), label: "Improvement Tips", screen: "improvement" },

  { icon: icon(clock), label: "CV History", screen: "cv-history" },

  {
    icon: icon(clipboardCheck),
    label: "Application Tracker",
    screen: "app-tracker",
  },

  { icon: icon(bookOpen), label: "JD Library", screen: "jd-library" },
  { icon: icon(briefcase), label: "Job Search", screen: "job-search" },

  { icon: icon(userCircle), label: "Profile", screen: "profile" },
]

export const hrNavItems: NavItem[] = [
  { icon: icon(chartBar), label: "Dashboard", screen: "hr-dashboard" },

  { icon: icon(briefcase), label: "Job Posts", screen: "job-posts" },

  { icon: icon(users), label: "CV Ranking", screen: "cv-ranking" },

  { icon: icon(funnel), label: "Pipeline", screen: "pipeline" },

  { icon: icon(envelope), label: "Auto Email", screen: "auto-email" },

  { icon: icon(chartBar), label: "Reports", screen: "reports" },

  { icon: icon(cog), label: "Settings", screen: "hr-settings" },
]

export function getPortalNavigation(portal: Portal): NavItem[] {
  return portal === "seeker" ? seekerNavItems : hrNavItems
}
