import type { AuthSession } from "@/types/auth"

const SESSION_KEY = "fitcv.auth.session"

const sessionExpiredListeners = new Set<() => void>()
let sessionExpiryNotified = false

function canUseStorage() {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  )
}

export interface BackendAuthSession {
  access_token: string

  token_type?: "bearer"

  requires_role_selection: boolean

  user: {
    account_id: number

    email: string

    full_name: string

    role: AuthSession["user"]["role"]

    avatar_url?: string | null

    auth_provider?: AuthSession["user"]["authProvider"]
  }
}

export function normalizeBackendSession(
  payload: BackendAuthSession,
): AuthSession {
  return {
    accessToken: payload.access_token,

    tokenType: payload.token_type ?? "bearer",

    requiresRoleSelection: payload.requires_role_selection,

    user: {
      accountId: String(payload.user.account_id),

      email: payload.user.email,

      fullName: payload.user.full_name,

      role: payload.user.role,

      avatarUrl: payload.user.avatar_url,

      authProvider: payload.user.auth_provider ?? "Password",
    },
  }
}

export function persistBackendSession(
  payload: BackendAuthSession,
): AuthSession {
  const session = normalizeBackendSession(payload)

  storeSession(session)

  return session
}

export function getStoredSession(): AuthSession | null {
  if (!canUseStorage()) return null

  const raw = window.sessionStorage.getItem(SESSION_KEY)

  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY)

    return null
  }
}

export function storeSession(session: AuthSession): void {
  if (!canUseStorage()) return

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // sessionStorage vẫn là nguồn lưu token; localStorage chỉ được dọn tương thích.
  }
  sessionExpiryNotified = false
}

export function clearStoredSession(): void {
  if (!canUseStorage()) return

  window.sessionStorage.removeItem(SESSION_KEY)
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Không để privacy mode chặn việc xóa token khỏi sessionStorage.
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Phiên làm việc đã hết hạn.")
    this.name = "SessionExpiredError"
  }
}

export function subscribeToSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

export function expireStoredSession(): void {
  clearStoredSession()
  if (sessionExpiryNotified) return

  sessionExpiryNotified = true
  sessionExpiredListeners.forEach((listener) => listener())
}
