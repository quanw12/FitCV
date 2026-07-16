import type { AccountRole, AuthProvider } from "./auth"

export interface CompanySummary {
  companyId: string
  companyName: string
  industryId: string | null
  industryName: string | null
  websiteUrl: string | null
  logoUrl: string | null
}

export interface UserProfile {
  accountId: string
  email: string
  fullName: string
  role: AccountRole | null
  avatarUrl: string | null
  authProvider: AuthProvider
  createdAt: string
  updatedAt: string | null
  phone: string | null
  company: CompanySummary | null
}

export interface ProfileUpdate {
  fullName?: string
  avatarUrl?: string | null
  phone?: string | null
  companyName?: string | null
  industryName?: string | null
  companyWebsiteUrl?: string | null
  companyLogoUrl?: string | null
}
