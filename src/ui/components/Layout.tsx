import { useState } from 'react'
import {
  Zap, ChevronLeft, ChevronRight, Bell, Search, LogOut, ChevronDown, Command,
} from 'lucide-react'
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
  const avatarInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div data-portal={portal} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Ink sidebar */}
      <aside className="fc-sidebar" style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', minWidth: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}>
        <div className="fc-sidebar__brand">
          <div className="fc-brandmark">
            <Zap size={20} color="white" fill="white" />
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
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="fc-topbar">
          <div className="fc-search">
            <Search size={15} color="var(--text-muted)" />
            <input
              placeholder="Search candidates, jobs, insights…"
              style={{ border: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-primary)', outline: 'none', width: '100%' }}
            />
            <kbd style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3, background: 'var(--surface)' }}><Command size={10} />K</kbd>
          </div>

          <div style={{ flex: 1 }} />

          <button className="fc-icon-btn" aria-label="Notifications">
            <Bell size={20} />
            <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, background: 'var(--danger)', borderRadius: '50%', border: '2px solid white', animation: 'fc-pulse-dot 2s ease-in-out infinite' }} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="fc-navitem"
              style={{ flexDirection: 'row', gap: 10, padding: '5px 8px 5px 6px', background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <span className="fc-avatar" style={{ position: 'relative', overflow: 'hidden' }}>
                {avatarInitials}
                {userAvatarUrl && (
                  <img
                    key={userAvatarUrl}
                    src={userAvatarUrl}
                    alt=""
                    onError={event => {
                      event.currentTarget.style.display = 'none'
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{userName}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: 8, minWidth: 180, zIndex: 100, animation: 'fc-pop 0.14s ease' }}>
                <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{userName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{portalLabel} workspace</div>
                </div>
                <button
                  onClick={onLogout}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 30, position: 'relative' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
