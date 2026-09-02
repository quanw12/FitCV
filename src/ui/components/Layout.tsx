import { useEffect, useState } from "react"

import { Moon, SignOut, Sun } from "@phosphor-icons/react"

import FloatingTopbar from "./FloatingTopbar"
import CommandPalette from "./CommandPalette"
import ScrollMotion from "./ScrollMotion"
import HiringFlow from "./HiringFlow"
import SeekerFlow from "./SeekerFlow"

import { getPortalNavigation } from "@/data/navigation"

import {
  applyTheme,
  persistTheme,
  resolveTheme,
  type Theme,
} from "@/services/theme"

import type { Portal, ScreenId } from "@/types/app"

interface LayoutProps {
  portal: Portal
  currentScreen: ScreenId | ""
  onNavigate: (screen: ScreenId) => void
  onLogout: () => void
  children: React.ReactNode
  userName?: string
  userAvatarUrl?: string | null
}

export default function Layout({
  portal,
  currentScreen,
  onNavigate,
  onLogout,
  children,
  userName = "Nguyen Minh",
  userAvatarUrl,
}: LayoutProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        setPaletteOpen((isOpen) => !isOpen)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light"
      persistTheme(nextTheme)
      return nextTheme
    })
  }

  const navItems = getPortalNavigation(portal)
  const portalLabel = portal === "seeker" ? "Job Seeker" : "HR Recruiter"
  const accountScreen: ScreenId = portal === "seeker" ? "profile" : "hr-settings"
  const accountItem = navItems.find((item) => item.screen === accountScreen)

  return (
    <div data-portal={portal} className="fc-app-shell">
      <div className="fc-app-main">
        <div className="fc-topbar-wrap">
          <FloatingTopbar
            userName={userName}
            userAvatarUrl={userAvatarUrl}
            navItems={navItems}
            currentScreen={currentScreen}
            onNavigate={onNavigate}
            onUserMenuClick={() => setShowUserMenu((isOpen) => !isOpen)}
          />

          {showUserMenu && (
            <div className="fc-user-menu">
              <div
                style={{
                  padding: "8px 12px 12px",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {userName}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {portalLabel} workspace
                </div>
              </div>
              {accountItem && (
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    onNavigate(accountScreen)
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {accountItem.icon} {accountItem.label}
                </button>
              )}
              <button
                onClick={toggleTheme}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 9,
                  padding: "9px 12px",
                  borderRadius: 9,
                  border: "none",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  {theme === "light" ? <Moon size={15} weight="light" /> : <Sun size={15} weight="light" />}
                  {theme === "light" ? "Dark mode" : "Light mode"}
                </span>
                <span className="fc-theme-toggle" aria-hidden="true"><span /></span>
              </button>
              <button
                onClick={onLogout}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 12px",
                  borderRadius: 9,
                  border: "none",
                  background: "transparent",
                  color: "var(--danger)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <SignOut size={15} weight="light" /> Sign out
              </button>
            </div>
          )}
        </div>

        <div className="fc-hiring-flow-wrap">
          {portal === "hr" ? (
            <HiringFlow currentScreen={currentScreen} onNavigate={onNavigate} />
          ) : (
            <SeekerFlow currentScreen={currentScreen} onNavigate={onNavigate} />
          )}
        </div>

        <main className="fc-app-content">
          <ScrollMotion key={`${portal}-${currentScreen}`}>{children}</ScrollMotion>
        </main>
      </div>

      <CommandPalette
        portal={portal}
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  )
}
