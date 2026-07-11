import type { Portal } from '@/types/app'

export type AccountRole = 'Student' | 'HR' | 'HiringManager' | 'Admin'
export type AuthProvider = 'Password' | 'Google'
export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

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
  email: string
  fullName: string
  avatarUrl?: string | null
}

export interface SelectRoleRequest {
  role: AccountRole
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponse {
  message: string
  resetToken?: string | null
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface AuthFormErrors {
  email?: string
  password?: string
  fullName?: string
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
