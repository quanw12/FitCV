import type {
  AuthSession,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  OAuthLoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SelectRoleRequest,
  VerifyResetCodeRequest,
  VerifyResetCodeResponse,
} from '@/types/auth'
import { clearStoredSession, getStoredSession, storeSession } from './authSession'
import { requestJson } from './httpClient'

interface BackendAuthSession {
  access_token: string
  token_type?: 'bearer'
  requires_role_selection: boolean
  user: {
    account_id: number
    email: string
    full_name: string
    role: AuthSession['user']['role']
    avatar_url?: string | null
    auth_provider?: AuthSession['user']['authProvider']
  }
}

function normalizeBackendSession(payload: BackendAuthSession): AuthSession {
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type ?? 'bearer',
    requiresRoleSelection: payload.requires_role_selection,
    user: {
      accountId: String(payload.user.account_id),
      email: payload.user.email,
      fullName: payload.user.full_name,
      role: payload.user.role,
      avatarUrl: payload.user.avatar_url,
      authProvider: payload.user.auth_provider ?? 'Password',
    },
  }
}

function persistBackendSession(payload: BackendAuthSession): AuthSession {
  const session = normalizeBackendSession(payload)
  storeSession(session)
  return session
}

export const authApi = {
  getSession: getStoredSession,

  logout: clearStoredSession,

  async register(payload: RegisterRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        full_name: payload.fullName,
      }),
    })
    return persistBackendSession(response)
  },

  async login(payload: LoginRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return persistBackendSession(response)
  },

  async oauthLogin(payload: OAuthLoginRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>('/api/auth/oauth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return persistBackendSession(response)
  },

  async selectRole(payload: SelectRoleRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>('/api/auth/select-role', {
      method: 'POST',
      authenticated: true,
      body: JSON.stringify(payload),
    })
    return persistBackendSession(response)
  },

  forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    return requestJson('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  verifyResetCode(payload: VerifyResetCodeRequest): Promise<VerifyResetCodeResponse> {
    return requestJson('/api/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  resetPassword(payload: ResetPasswordRequest): Promise<void> {
    return requestJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
