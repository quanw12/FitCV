import type { ProfileUpdate, UserProfile } from "@/types/profile"

import { authApi } from "./authApi"

import { requestJson } from "./httpClient"

let profileCache: UserProfile | null = null

let profileCacheAccountId: string | null = null

let profileFetchInFlight: Promise<UserProfile> | null = null

let profileFetchAccountId: string | null = null

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

          industryId:
            payload.company.industry_id == null
              ? null
              : String(payload.company.industry_id),

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
  const payload = await requestJson<unknown>("/api/profile", {
    method,
    authenticated: true,
    ...(update ? { body: JSON.stringify(requestBody(update)) } : {}),
  })
  return normalize(payload)
}

async function avatarRequest(
  method: "POST" | "DELETE",

  file?: File,
): Promise<UserProfile> {
  const body = file ? new FormData() : undefined

  if (file) body!.append("file", file)

  const payload = await requestJson<unknown>("/api/profile/avatar", {
    method,
    authenticated: true,
    body,
  })
  return normalize(payload)
}

export const profileApi = {
  async get(): Promise<UserProfile> {
    const session = authApi.getSession()

    if (!session) throw new Error("Authentication required.")

    if (
      profileCache &&
      profileCacheAccountId === session.user.accountId
    ) {
      return profileCache
    }

    if (
      profileFetchInFlight &&
      profileFetchAccountId === session.user.accountId
    ) {
      return profileFetchInFlight
    }

    profileFetchAccountId = session.user.accountId
    profileFetchInFlight = backendRequest("GET").then((profile) => {
      profileCache = profile
      profileCacheAccountId = profile.accountId

      return profile
    })

    try {
      return await profileFetchInFlight
    } finally {
      profileFetchInFlight = null
      profileFetchAccountId = null
    }
  },

  clearCache() {
    profileCache = null
    profileCacheAccountId = null
  },

  async update(update: ProfileUpdate): Promise<UserProfile> {
    const profile = await backendRequest("PATCH", update)

    authApi.updateCurrentUser({
      fullName: profile.fullName,

      avatarUrl: profile.avatarUrl,
    })

    profileCache = profile
    profileCacheAccountId = profile.accountId

    return profile
  },

  async uploadAvatar(file: File): Promise<UserProfile> {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Choose a JPG, PNG, or WebP image.")

    if (file.size > 5 * 1024 * 1024)
      throw new Error("Avatar must be 5MB or smaller.")

    const profile = await avatarRequest("POST", file)

    authApi.updateCurrentUser({ avatarUrl: profile.avatarUrl })

    profileCache = profile
    profileCacheAccountId = profile.accountId

    return profile
  },

  async deleteAvatar(): Promise<UserProfile> {
    const profile = await avatarRequest("DELETE")

    authApi.updateCurrentUser({ avatarUrl: null })

    profileCache = profile
    profileCacheAccountId = profile.accountId

    return profile
  },
}
