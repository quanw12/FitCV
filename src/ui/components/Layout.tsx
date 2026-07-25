import { useState } from 'react'
import { Lightning, CaretLeft, CaretRight, SignOut } from '@phosphor-icons/react'
import FloatingTopbar from "./FloatingTopbar"
import { getPortalNavigation } from '@/data/navigation'
import type { Portal, ScreenId } from '@/types/app'

interface LayoutProps {
  portal: Portal
  currentScreen: ScreenId | ''
  onNavigate: (screen: ScreenId) => void
  onLogout: () => void
  children: React.ReactNode
  userName?: string
  userAvatarUrl?: string | null
}

export default function Layout({ portal, currentScreen, onNavigate, onLogout, children, userName = 'Nguyen Minh', userAvatarUrl }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = getPortalNavigation(portal)
  const portalLabel = portal === 'seeker' ? 'Job Seeker' : 'HR Recruiter'

  return (
    <div data-portal={portal} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Ink sidebar */}
      <aside className="fc-sidebar" style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', minWidth: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}>
        <div className="fc-sidebar__brand">
          <div className="fc-brandmark">
            <Lightning size={20} color="white" weight="light" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'white', lineHeight: 1 }}>FitCV</div>
              <div style={{ fontSize: 10.5, color: '#8b95b5', fontWeight: 600, marginTop: 3, letterSpacing: '0.04em' }}>{portalLabel}</div>
            </div>
          )}
        </div>

        <nav className="fc-sidebar__nav">
          {navItems.map(item => {
            const active = currentScreen === item.screen
            return (
              <button
                key={item.screen}
                onClick={() => onNavigate(item.screen)}
                className={`fc-navitem ${active ? 'fc-navitem--active' : ''}`}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="fc-sidebar__footer">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="fc-navitem"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', marginBottom: 0 }}
          >
            {collapsed ? <CaretRight size={16} weight="light" /> : <><CaretLeft size={16} weight="light" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ position: 'relative' }}>
          <FloatingTopbar
            userName={userName}
            userAvatarUrl={userAvatarUrl}
            onSearchFocus={() => {}}
            onUserMenuClick={() => setShowUserMenu(!showUserMenu)}
          />
          {showUserMenu && (
            <div style={{ position: 'absolute', top: 'calc(8px + var(--topbar-h) + 4px)', right: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: 8, minWidth: 180, zIndex: 100, animation: 'fc-pop 0.14s ease' }}>
              <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{userName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{portalLabel} workspace</div>
              </div>
              <button
                onClick={onLogout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
              >
                <SignOut size={15} weight="light" /> Sign out
              </button>
            </div>
          )}
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: 30, position: 'relative' }}>
          {children}
        </main>
        <div className="fc-grain" />
      </div>
    </div>
  )
}
