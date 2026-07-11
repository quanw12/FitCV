import { useState } from 'react'
import {
  Zap, ChevronLeft, ChevronRight, Bell, Search, LogOut, ChevronDown
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
}

export default function Layout({ portal, currentScreen, onNavigate, onLogout, children, userName = 'Nguyen Minh' }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = getPortalNavigation(portal)
  const portalLabel = portal === 'seeker' ? 'Job Seeker' : 'HR Recruiter'
  const avatarInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
        background: 'white',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1 }}>FitCV</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{portalLabel}</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = currentScreen === item.screen
            return (
              <button
                key={item.screen}
                onClick={() => onNavigate(item.screen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 12px' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  border: 'none',
                  background: active ? 'var(--indigo-light)' : 'transparent',
                  color: active ? 'var(--indigo)' : 'var(--text-secondary)',
                  fontFamily: 'Inter',
                  fontWeight: active ? 600 : 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  marginBottom: 2,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8, padding: '8px 12px', borderRadius: 10, border: 'none',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top header */}
        <header style={{
          height: 60, background: 'white', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{
            flex: 1, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px',
          }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              placeholder="Search..."
              style={{ border: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-primary)', outline: 'none', width: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {/* Bell */}
          <button style={{
            position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 8, borderRadius: 10, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center',
          }}>
            <Bell size={20} />
            <span style={{
              position: 'absolute', top: 6, right: 6, width: 8, height: 8,
              background: '#EF4444', borderRadius: '50%', border: '2px solid white',
            }} />
          </button>

          {/* User */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 11, fontWeight: 700,
              }}>
                {avatarInitials}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{userName}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                background: 'white', border: '1px solid var(--border)', borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, minWidth: 160, zIndex: 100,
              }}>
                <button
                  onClick={onLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderRadius: 8, border: 'none', background: 'transparent', color: '#EF4444',
                    fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
