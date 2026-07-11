import type { AuthFormErrors, LoginRequest, RegisterRequest, ResetPasswordRequest } from '@/types/auth'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string) {
  if (!email.trim()) return 'Email is required.'
  if (!emailPattern.test(email.trim())) return 'Enter a valid email address.'
  return undefined
}

export function validatePassword(password: string) {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return undefined
}

export function validateFullName(fullName: string) {
  if (!fullName.trim()) return 'Full name is required.'
  if (fullName.trim().length < 2) return 'Full name must be at least 2 characters.'
  return undefined
}

export function validateLogin(payload: LoginRequest): AuthFormErrors {
  return {
    email: validateEmail(payload.email),
    password: payload.password ? undefined : 'Password is required.',
  }
}

export function validateRegister(payload: RegisterRequest): AuthFormErrors {
  return {
    email: validateEmail(payload.email),
    password: validatePassword(payload.password),
    fullName: validateFullName(payload.fullName),
  }
}

export function validateResetPassword(payload: ResetPasswordRequest): AuthFormErrors {
  return {
    password: validatePassword(payload.password),
    general: payload.token.trim() ? undefined : 'Reset token is required.',
  }
}

export function hasAuthErrors(errors: AuthFormErrors) {
  return Object.values(errors).some(Boolean)
}
