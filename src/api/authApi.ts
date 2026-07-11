import {
  accountRoleFromPortal,
  type AccountRole,
  type AuthProvider,
  type AuthSession,
  type AuthUser,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type LoginRequest,
  type OAuthLoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type SelectRoleRequest,
} from '@/types/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const SESSION_KEY = 'fitcv.auth.session'
const ACCOUNTS_KEY = 'fitcv.auth.accounts'
const RESET_TOKENS_KEY = 'fitcv.auth.resetTokens'

interface StoredAccount {
  accountId: string
  email: string
  passwordHash: string | null
  fullName: string
  role: AccountRole | null
  avatarUrl?: string | null
  authProvider: AuthProvider
}

type ResetTokenRecord = Record<string, string>

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback
  const raw = window.localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function simpleHash(input: string) {
  return btoa(unescape(encodeURIComponent(input))).split('').reverse().join('')
}

function toUser(account: StoredAccount): AuthUser {
  return {
    accountId: account.accountId,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    avatarUrl: account.avatarUrl,
    authProvider: account.authProvider,
  }
}

function toSession(account: StoredAccount): AuthSession {
  return {
    accessToken: `mock-${account.accountId}-${Date.now()}`,
    tokenType: 'bearer',
    user: toUser(account),
    requiresRoleSelection: account.role === null,
  }
}

function normalizeBackendSession(payload: any): AuthSession {
  const user = payload.user
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type ?? 'bearer',
    requiresRoleSelection: Boolean(payload.requires_role_selection),
    user: {
      accountId: String(user.account_id),
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      avatarUrl: user.avatar_url,
      authProvider: user.auth_provider ?? 'Password',
    },
  }
}

async function postJson<T>(path: string, payload: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => undefined)
    throw new Error(error?.detail ?? 'Request failed.')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function shouldUseBackend() {
  return API_BASE_URL.length > 0
}

const mockAuthApi = {
  getSession(): AuthSession | null {
    return readJson<AuthSession | null>(SESSION_KEY, null)
  },

  saveSession(session: AuthSession) {
    writeJson(SESSION_KEY, session)
  },

  async register(payload: RegisterRequest): Promise<AuthSession> {
    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    const existing = accounts.find(account => account.email.toLowerCase() === payload.email.toLowerCase())
    if (existing) throw new Error('Email is already registered.')

    const account: StoredAccount = {
      accountId: crypto.randomUUID(),
      email: payload.email.toLowerCase(),
      passwordHash: simpleHash(payload.password),
      fullName: payload.fullName.trim(),
      role: null,
      authProvider: 'Password',
    }
    accounts.push(account)
    writeJson(ACCOUNTS_KEY, accounts)
    const session = toSession(account)
    this.saveSession(session)
    return session
  },

  async login(payload: LoginRequest): Promise<AuthSession> {
    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    let account = accounts.find(item => item.email.toLowerCase() === payload.email.toLowerCase())

    if (!account && payload.email === 'student@fitcv.dev') {
      account = {
        accountId: crypto.randomUUID(),
        email: payload.email,
        passwordHash: simpleHash(payload.password),
        fullName: 'Nguyen Minh',
        role: 'Student',
        authProvider: 'Password',
      }
      accounts.push(account)
      writeJson(ACCOUNTS_KEY, accounts)
    }

    if (!account || account.passwordHash !== simpleHash(payload.password)) {
      throw new Error('Invalid email or password.')
    }

    const session = toSession(account)
    this.saveSession(session)
    return session
  },

  async oauthLogin(payload: OAuthLoginRequest): Promise<AuthSession> {
    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    let account = accounts.find(item => item.email.toLowerCase() === payload.email.toLowerCase())
    if (!account) {
      account = {
        accountId: crypto.randomUUID(),
        email: payload.email.toLowerCase(),
        passwordHash: null,
        fullName: payload.fullName.trim(),
        role: null,
        avatarUrl: payload.avatarUrl,
        authProvider: 'Google',
      }
      accounts.push(account)
      writeJson(ACCOUNTS_KEY, accounts)
    }

    const session = toSession(account)
    this.saveSession(session)
    return session
  },

  async selectRole(payload: SelectRoleRequest): Promise<AuthSession> {
    const session = this.getSession()
    if (!session) throw new Error('Authentication required.')

    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    const account = accounts.find(item => item.accountId === session.user.accountId)
    if (!account) throw new Error('Account not found.')

    account.role = payload.role
    writeJson(ACCOUNTS_KEY, accounts)
    const nextSession = toSession(account)
    this.saveSession(nextSession)
    return nextSession
  },

  async forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    const account = accounts.find(item => item.email.toLowerCase() === payload.email.toLowerCase())
    if (!account) return { message: 'If the email exists, a reset link will be sent.' }

    const token = crypto.randomUUID()
    const resetTokens = readJson<ResetTokenRecord>(RESET_TOKENS_KEY, {})
    resetTokens[token] = account.accountId
    writeJson(RESET_TOKENS_KEY, resetTokens)
    return { message: 'Password reset token generated for demo.', resetToken: token }
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    const resetTokens = readJson<ResetTokenRecord>(RESET_TOKENS_KEY, {})
    const accountId = resetTokens[payload.token]
    if (!accountId) throw new Error('Reset token is invalid or expired.')

    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    const account = accounts.find(item => item.accountId === accountId)
    if (!account) throw new Error('Account not found.')

    account.passwordHash = simpleHash(payload.password)
    delete resetTokens[payload.token]
    writeJson(ACCOUNTS_KEY, accounts)
    writeJson(RESET_TOKENS_KEY, resetTokens)
  },

  logout() {
    if (!canUseStorage()) return
    window.localStorage.removeItem(SESSION_KEY)
  },
}

export const authApi = {
  getSession: mockAuthApi.getSession,

  logout: mockAuthApi.logout,

  async register(payload: RegisterRequest): Promise<AuthSession> {
    if (!shouldUseBackend()) return mockAuthApi.register(payload)
    const response = await postJson<any>('/api/auth/register', {
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName,
    })
    const session = normalizeBackendSession(response)
    mockAuthApi.saveSession(session)
    return session
  },

  async login(payload: LoginRequest): Promise<AuthSession> {
    if (!shouldUseBackend()) return mockAuthApi.login(payload)
    const response = await postJson<any>('/api/auth/login', payload)
    const session = normalizeBackendSession(response)
    mockAuthApi.saveSession(session)
    return session
  },

  async oauthLogin(payload: OAuthLoginRequest): Promise<AuthSession> {
    if (!shouldUseBackend()) return mockAuthApi.oauthLogin(payload)
    const response = await postJson<any>('/api/auth/oauth/google', {
      provider: payload.provider,
      email: payload.email,
      full_name: payload.fullName,
      avatar_url: payload.avatarUrl,
    })
    const session = normalizeBackendSession(response)
    mockAuthApi.saveSession(session)
    return session
  },

  async selectRole(payload: SelectRoleRequest): Promise<AuthSession> {
    if (!shouldUseBackend()) return mockAuthApi.selectRole(payload)
    const current = mockAuthApi.getSession()
    const response = await postJson<any>('/api/auth/select-role', payload, current?.accessToken)
    const session = normalizeBackendSession(response)
    mockAuthApi.saveSession(session)
    return session
  },

  async forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    if (!shouldUseBackend()) return mockAuthApi.forgotPassword(payload)
    const response = await postJson<any>('/api/auth/forgot-password', payload)
    return { message: response.message, resetToken: response.reset_token }
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    if (!shouldUseBackend()) return mockAuthApi.resetPassword(payload)
    await postJson<void>('/api/auth/reset-password', payload)
  },

  accountRoleFromPortal,
}
