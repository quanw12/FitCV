import type { AuthSession } from '@/types/auth'

const SESSION_KEY = 'fitcv.auth.session'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getStoredSession(): AuthSession | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function storeSession(session: AuthSession): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession(): void {
  if (!canUseStorage()) return
  window.localStorage.removeItem(SESSION_KEY)
}
