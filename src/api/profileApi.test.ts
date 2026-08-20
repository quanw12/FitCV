import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateCurrentUser: vi.fn(),
}))

const httpMocks = vi.hoisted(() => ({
  requestJson: vi.fn(),
}))

vi.mock("./authApi", () => ({ authApi: authMocks }))
vi.mock("./httpClient", () => httpMocks)

import { profileApi } from "./profileApi"

const backendProfile = {
  account_id: 13,
  email: "hr@example.com",
  full_name: "HR User",
  role: "HR",
  avatar_url: null,
  auth_provider: "Google",
  created_at: "2026-08-19T00:00:00Z",
  updated_at: null,
  phone: null,
  company: {
    company_id: 8,
    company_name: "FPT",
    industry_id: 4,
    industry_name: "SWE",
    website_url: null,
    logo_url: null,
  },
}

describe("profileApi backend persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    profileApi.clearCache()
    authMocks.getSession.mockReturnValue({
      accessToken: "token",
      user: { accountId: "13" },
    })
    httpMocks.requestJson.mockResolvedValue(backendProfile)
  })

  it("loads the profile through the relative backend API in development", async () => {
    const profile = await profileApi.get()

    expect(httpMocks.requestJson).toHaveBeenCalledWith("/api/profile", {
      method: "GET",
      authenticated: true,
    })
    expect(profile.company?.companyName).toBe("FPT")
  })

  it("persists company onboarding through PATCH instead of localStorage", async () => {
    await profileApi.update({
      fullName: "HR User",
      companyName: "FPT",
      industryName: "SWE",
    })

    expect(httpMocks.requestJson).toHaveBeenCalledWith("/api/profile", {
      method: "PATCH",
      authenticated: true,
      body: JSON.stringify({
        full_name: "HR User",
        company_name: "FPT",
        industry_name: "SWE",
      }),
    })
  })
})
