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
  type VerifyResetCodeRequest,
  type VerifyResetCodeResponse,
} from '@/types/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const SESSION_KEY = 'fitcv.auth.session'
const ACCOUNTS_KEY = 'fitcv.auth.accounts'
const RESET_CODES_KEY = 'fitcv.auth.resetCodes'

interface StoredAccount {
  accountId: string
  email: string
  passwordHash: string | null
  fullName: string
  role: AccountRole | null
  avatarUrl?: string | null
  authProvider: AuthProvider
}

type ResetCodeRecord = Record<string, { accountId: string; code: string; expiresAt: number }>

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

function decodeJwtPayload(token: string): Record<string, any> {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Google credential is invalid.')
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const json = decodeURIComponent(
    atob(paddedBase64)
      .split('')
      .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  )
  return JSON.parse(json) as Record<string, any>
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
    const profile = decodeJwtPayload(payload.credential)
    if (!profile.email) throw new Error('Google credential is missing an email.')

    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    let account = accounts.find(item => item.email.toLowerCase() === String(profile.email).toLowerCase())
    if (!account) {
      account = {
        accountId: crypto.randomUUID(),
        email: String(profile.email).toLowerCase(),
        passwordHash: null,
        fullName: String(profile.name ?? profile.email).trim(),
        role: null,
        avatarUrl: typeof profile.picture === 'string' ? profile.picture : null,
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
    if (!account) return { message: 'If the email exists, a verification code will be sent.' }

    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    const resetCodes = readJson<ResetCodeRecord>(RESET_CODES_KEY, {})
    resetCodes[account.email.toLowerCase()] = {
      accountId: account.accountId,
      code,
      expiresAt: Date.now() + 30 * 60 * 1000,
    }
    writeJson(RESET_CODES_KEY, resetCodes)
    console.info(`PASSWORD_RESET_CODE for ${account.email}: ${code}`)
    return { message: 'If the email exists, a verification code will be sent.' }
  },

  async verifyResetCode(payload: VerifyResetCodeRequest): Promise<VerifyResetCodeResponse> {
    const resetCodes = readJson<ResetCodeRecord>(RESET_CODES_KEY, {})
    const record = resetCodes[payload.email.toLowerCase()]
    if (!record || record.code !== payload.code || record.expiresAt < Date.now()) {
      throw new Error('Verification code is invalid or expired.')
    }
    return { message: 'Verification code accepted. Choose a new password.' }
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    const resetCodes = readJson<ResetCodeRecord>(RESET_CODES_KEY, {})
    const record = resetCodes[payload.email.toLowerCase()]
    if (!record || record.code !== payload.code || record.expiresAt < Date.now()) {
      throw new Error('Verification code is invalid or expired.')
    }

    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
    const account = accounts.find(item => item.accountId === record.accountId)
    if (!account) throw new Error('Account not found.')

    account.passwordHash = simpleHash(payload.password)
    delete resetCodes[payload.email.toLowerCase()]
    writeJson(ACCOUNTS_KEY, accounts)
    writeJson(RESET_CODES_KEY, resetCodes)
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
      credential: payload.credential,
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
    return { message: response.message }
  },

  async verifyResetCode(payload: VerifyResetCodeRequest): Promise<VerifyResetCodeResponse> {
    if (!shouldUseBackend()) return mockAuthApi.verifyResetCode(payload)
    const response = await postJson<any>('/api/auth/verify-reset-code', payload)
    return { message: response.message }
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    if (!shouldUseBackend()) return mockAuthApi.resetPassword(payload)
    await postJson<void>('/api/auth/reset-password', payload)
  },

  accountRoleFromPortal,
}
