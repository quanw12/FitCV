import type { Portal } from '@/types/app'

export type AccountRole = 'Student' | 'HR' | 'HiringManager' | 'Admin'
export type AuthProvider = 'Password' | 'Google'
export type AuthMode = 'login' | 'register' | 'forgot' | 'verify' | 'reset'

export interface AuthUser {
  accountId: string
  email: string
  fullName: string
  role: AccountRole | null
  avatarUrl?: string | null
  authProvider: AuthProvider
}

export interface AuthSession {
  accessToken: string
  tokenType: 'bearer'
  user: AuthUser
  requiresRoleSelection: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  fullName: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface OAuthLoginRequest {
  provider: 'google'
  credential: string
}

export interface SelectRoleRequest {
  role: AccountRole
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponse {
  message: string
}

export interface VerifyResetCodeRequest {
  email: string
  code: string
}

export interface VerifyResetCodeResponse {
  message: string
}

export interface ResetPasswordRequest {
  email: string
  code: string
  password: string
}

export interface AuthFormErrors {
  email?: string
  password?: string
  fullName?: string
  code?: string
  general?: string
}

export function isPortalRole(role: AccountRole | null): role is 'Student' | 'HR' {
  return role === 'Student' || role === 'HR'
}

export function portalFromAccountRole(role: AccountRole): Portal {
  return role === 'HR' || role === 'HiringManager' || role === 'Admin' ? 'hr' : 'seeker'
}

export function accountRoleFromPortal(portal: Portal): AccountRole {
  return portal === 'hr' ? 'HR' : 'Student'
}
