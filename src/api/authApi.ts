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
} from "@/types/auth"

import {
  type BackendAuthSession,
  clearStoredSession,
  getStoredSession,
  persistBackendSession,
  storeSession,
} from "./authSession"

import { requestJson } from "./httpClient"

export const authApi = {
  getSession: getStoredSession,

  async logout(): Promise<void> {
    try {
      await requestJson<void>("/api/auth/logout", {
        method: "POST",
        authenticated: true,
      })
    } finally {
      clearStoredSession()
    }
  },

  async refresh(): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>(
      "/api/auth/refresh",
      { method: "POST" },
    )
    return persistBackendSession(response)
  },

  updateCurrentUser(
    patch: Partial<Pick<AuthSession["user"], "fullName" | "avatarUrl">>,
  ): AuthSession | null {
    const current = getStoredSession()

    if (!current) return null

    const updated = {
      ...current,

      user: { ...current.user, ...patch },
    }

    storeSession(updated)

    return updated
  },

  async register(payload: RegisterRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>(
      "/api/auth/register",
      {
        method: "POST",

        body: JSON.stringify({
          email: payload.email,

          password: payload.password,

          full_name: payload.fullName,
        }),
      },
    )

    return persistBackendSession(response)
  },

  async login(payload: LoginRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>("/api/auth/login", {
      method: "POST",

      body: JSON.stringify(payload),
    })

    return persistBackendSession(response)
  },

  async oauthLogin(payload: OAuthLoginRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>(
      "/api/auth/oauth/google",
      {
        method: "POST",

        body: JSON.stringify(payload),
      },
    )

    return persistBackendSession(response)
  },

  async selectRole(payload: SelectRoleRequest): Promise<AuthSession> {
    const response = await requestJson<BackendAuthSession>(
      "/api/auth/select-role",
      {
        method: "POST",

        authenticated: true,

        body: JSON.stringify(payload),
      },
    )

    return persistBackendSession(response)
  },

  forgotPassword(
    payload: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return requestJson("/api/auth/forgot-password", {
      method: "POST",

      body: JSON.stringify(payload),
    })
  },

  verifyResetCode(
    payload: VerifyResetCodeRequest,
  ): Promise<VerifyResetCodeResponse> {
    return requestJson("/api/auth/verify-reset-code", {
      method: "POST",

      body: JSON.stringify(payload),
    })
  },

  resetPassword(payload: ResetPasswordRequest): Promise<void> {
    clearStoredSession()
    return requestJson("/api/auth/reset-password", {
      method: "POST",

      body: JSON.stringify(payload),
    })
  },
}
