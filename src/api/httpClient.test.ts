import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/types/auth"

import { storeSession, subscribeToSessionExpired } from "./authSession"
import { requestJson } from "./httpClient"

const session: AuthSession = {
  accessToken: "expired-access-token",
  tokenType: "bearer",
  requiresRoleSelection: false,
  user: {
    accountId: "1",
    email: "student@example.com",
    fullName: "Student",
    role: "Student",
    authProvider: "Password",
  },
}

describe("authenticated request expiry", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    storeSession(session)
    vi.stubGlobal("fetch", vi.fn())
  })

  it("deduplicates refresh and emits one expiry without calling logout", async () => {
    let finishRefresh: ((response: Response) => void) | undefined
    const refreshResponse = new Promise<Response>((resolve) => {
      finishRefresh = resolve
    })
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith("/api/auth/refresh")) return refreshResponse
      return Promise.resolve(new Response(null, { status: 401 }))
    })
    const listener = vi.fn()
    const unsubscribe = subscribeToSessionExpired(listener)

    const requests = Promise.allSettled([
      requestJson("/api/profile", { authenticated: true }),
      requestJson("/api/jobs/manage", { authenticated: true }),
    ])
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/api/auth/refresh"),
        ),
      ).toHaveLength(1)
    })
    finishRefresh?.(new Response(null, { status: 401 }))
    await requests

    expect(listener).toHaveBeenCalledOnce()
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("/logout")),
    ).toBe(false)
    unsubscribe()
  })
})
