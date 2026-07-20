import type { ProfileUpdate, UserProfile } from "@/types/profile"
import { authApi } from "./authApi"
import { API_BASE_URL, apiConnectionErrorMessage } from "./config"

const LOCAL_PROFILE_KEY = "fitcv.profile.records"

interface ValidationDetail {
  loc?: Array<string | number>
  msg?: string
}

function readRecords(): Record<string, UserProfile> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(
      window.localStorage.getItem(LOCAL_PROFILE_KEY) ?? "{}",
    ) as Record<string, UserProfile>
  } catch {
    return {}
  }
}

function writeRecords(records: Record<string, UserProfile>) {
  window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(records))
}

function emptyLocalProfile(): UserProfile {
  const session = authApi.getSession()
  if (!session) throw new Error("Authentication required.")
  return {
    accountId: session.user.accountId,
    email: session.user.email,
    fullName: session.user.fullName,
    role: session.user.role,
    avatarUrl: session.user.avatarUrl ?? null,
    authProvider: session.user.authProvider,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    phone: null,
    company: null,
  }
}

function getLocalProfile(): UserProfile {
  const base = emptyLocalProfile()
  return readRecords()[base.accountId] ?? base
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail
  if (!Array.isArray(detail)) return fallback

  const messages = detail
    .map((item: ValidationDetail) => {
      if (typeof item?.msg !== "string") return null
      const field = item.loc
        ?.filter((part) => part !== "body")
        .map(String)
        .join(".")
      return field ? `${field}: ${item.msg}` : item.msg
    })
    .filter((message): message is string => Boolean(message))

  return messages.length > 0 ? messages.join("; ") : fallback
}

function normalize(payload: any): UserProfile {
  return {
    accountId: String(payload.account_id),
    email: payload.email,
    fullName: payload.full_name,
    role: payload.role,
    avatarUrl: payload.avatar_url,
    authProvider: payload.auth_provider,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    phone: payload.phone,
    company: payload.company
      ? {
          companyId: String(payload.company.company_id),
          companyName: payload.company.company_name,
          industryId: payload.company.industry_id == null ? null : String(payload.company.industry_id),
          industryName: payload.company.industry_name,
          websiteUrl: payload.company.website_url,
          logoUrl: payload.company.logo_url,
        }
      : null,
  }
}

function requestBody(update: ProfileUpdate) {
  return {
    full_name: update.fullName,
    avatar_url: update.avatarUrl,
    phone: update.phone,
    company_name: update.companyName,
    industry_name: update.industryName,
    company_website_url: update.companyWebsiteUrl,
    company_logo_url: update.companyLogoUrl,
  }
}

async function backendRequest(
  method: "GET" | "PATCH",
  update?: ProfileUpdate,
): Promise<UserProfile> {
  const session = authApi.getSession()
  if (!session) throw new Error("Authentication required.")
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/profile`, {
      method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(update ? { "Content-Type": "application/json" } : {}),
      },
      ...(update ? { body: JSON.stringify(requestBody(update)) } : {}),
    })
  } catch {
    throw new Error(apiConnectionErrorMessage())
  }
  if (!response.ok) {
    const error = await response.json().catch(() => undefined)
    const fallback =
      method === "GET" ? "Unable to load profile." : "Unable to update profile."
    throw new Error(errorMessage(error?.detail, fallback))
  }
  return normalize(await response.json())
}

async function avatarRequest(method: "POST" | "DELETE", file?: File): Promise<UserProfile> {
  const session = authApi.getSession()
  if (!session) throw new Error("Authentication required.")
  const body = file ? new FormData() : undefined
  if (file) body!.append("file", file)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
      method,
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body,
    })
  } catch {
    throw new Error(apiConnectionErrorMessage())
  }
  if (!response.ok) {
    const error = await response.json().catch(() => undefined)
    throw new Error(errorMessage(error?.detail, method === "POST" ? "Unable to upload photo." : "Unable to remove photo."))
  }
  return normalize(await response.json())
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Unable to read this image."))
    reader.readAsDataURL(file)
  })
}

function persistLocal(profile: UserProfile): UserProfile {
  const records = readRecords()
  records[profile.accountId] = profile
  writeRecords(records)
  authApi.updateCurrentUser({ fullName: profile.fullName, avatarUrl: profile.avatarUrl })
  return profile
}

export const profileApi = {
  async get(): Promise<UserProfile> {
    if (API_BASE_URL) return backendRequest("GET")
    return getLocalProfile()
  },
  async update(update: ProfileUpdate): Promise<UserProfile> {
    let profile: UserProfile
    if (API_BASE_URL) profile = await backendRequest("PATCH", update)
    else {
      const current = getLocalProfile()
      const hasCompanyUpdate = [update.companyName, update.industryName, update.companyWebsiteUrl, update.companyLogoUrl].some((value) => value !== undefined)
      const hasCompanyRole = current.role === "HR" || current.role === "HiringManager" || current.role === "Admin"
      if (update.phone !== undefined && current.role !== "Student") throw new Error("Phone can only be updated by Student accounts.")
      if (hasCompanyUpdate && !hasCompanyRole) throw new Error("Company fields can only be updated by HR, HiringManager, or Admin accounts.")
      if (hasCompanyUpdate && !current.company && !update.companyName?.trim()) throw new Error("Company name is required when creating a company.")
      if (update.companyName !== undefined && !update.companyName?.trim()) throw new Error("Company name cannot be empty.")
      const now = new Date().toISOString()
      profile = {
        ...current,
        fullName: update.fullName ?? current.fullName,
        avatarUrl: update.avatarUrl === undefined ? current.avatarUrl : update.avatarUrl,
        phone: current.role === "Student" && update.phone !== undefined ? update.phone : current.phone,
        company: !hasCompanyRole || !hasCompanyUpdate ? current.company : {
          companyId: current.company?.companyId ?? `local-${current.accountId}`,
          companyName: update.companyName ?? current.company?.companyName ?? "",
          industryId: current.company?.industryId ?? null,
          industryName: update.industryName === undefined ? current.company?.industryName ?? null : update.industryName,
          websiteUrl: update.companyWebsiteUrl === undefined ? current.company?.websiteUrl ?? null : update.companyWebsiteUrl,
          logoUrl: update.companyLogoUrl === undefined ? current.company?.logoUrl ?? null : update.companyLogoUrl,
        },
        updatedAt: now,
      }
      const records = readRecords()
      records[profile.accountId] = profile
      writeRecords(records)
    }
    authApi.updateCurrentUser({
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    })
    return profile
  },
  async uploadAvatar(file: File): Promise<UserProfile> {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.")
    if (file.size > 5 * 1024 * 1024) throw new Error("Avatar must be 5MB or smaller.")
    let profile: UserProfile
    if (API_BASE_URL) profile = await avatarRequest("POST", file)
    else profile = persistLocal({ ...getLocalProfile(), avatarUrl: await fileAsDataUrl(file), updatedAt: new Date().toISOString() })
    authApi.updateCurrentUser({ avatarUrl: profile.avatarUrl })
    return profile
  },
  async deleteAvatar(): Promise<UserProfile> {
    let profile: UserProfile
    if (API_BASE_URL) profile = await avatarRequest("DELETE")
    else profile = persistLocal({ ...getLocalProfile(), avatarUrl: null, updatedAt: new Date().toISOString() })
    authApi.updateCurrentUser({ avatarUrl: null })
    return profile
  },
}
