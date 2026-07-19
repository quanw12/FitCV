import type { AccountRole } from "@/types/auth"
import type { UserProfile } from "@/types/profile"

export function requiresCompanyProfile(role: AccountRole | null): boolean {
  return role === "HR" || role === "HiringManager" || role === "Admin"
}

export function isCompanyProfileComplete(profile: UserProfile): boolean {
  return Boolean(
    profile.company?.companyName.trim() &&
      profile.company.industryName?.trim(),
  )
}
