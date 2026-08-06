import { Bell } from "@phosphor-icons/react"

import BrandMark from "./BrandMark"

import type { NavItem } from "@/data/navigation"
import type { ScreenId } from "@/types/app"

interface Props {
  userName: string
  userAvatarUrl?: string | null
  navItems: NavItem[]
  currentScreen: ScreenId | ""
  onNavigate: (screen: ScreenId) => void
  onUserMenuClick?: () => void
  onNotificationClick?: () => void
}

export default function FloatingTopbar({
  userName,
  userAvatarUrl,
  navItems,
  currentScreen,
  onNavigate,
  onUserMenuClick,
  onNotificationClick,
}: Props) {
  const initials = userName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  return (
    <header className="fc-topbar-surface">
      <button
        type="button"
        className="fc-topbar-brand"
        aria-label="FitCV home"
        onClick={() => onNavigate(navItems[0].screen)}
      >
        <BrandMark size={30} className="fc-topbar-brand-mark" />
        <span>FitCV</span>
      </button>

      <nav className="fc-topbar-nav" aria-label="Primary navigation">
        {navItems.filter((item) => item.screen !== "profile" && item.screen !== "hr-settings").map((item) => (
          <button
            type="button"
            key={item.screen}
            onClick={() => onNavigate(item.screen)}
            className={`fc-topbar-nav-item ${currentScreen === item.screen ? "is-active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="fc-topbar-actions">
        <button
          type="button"
          className="fc-icon-btn"
          aria-label="Notifications"
          title="View application updates"
          onClick={onNotificationClick}
        >
          <Bell size={18} weight="light" />
        </button>

        <button
          type="button"
          className="fc-icon-btn"
          aria-label="User menu"
          onClick={onUserMenuClick}
        >
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt={userName} className="fc-topbar-avatar" />
          ) : (
            <span className="fc-avatar fc-topbar-avatar">{initials}</span>
          )}
          <span className="fc-topbar-user-name">{userName}</span>
        </button>
      </div>
    </header>
  )
}
