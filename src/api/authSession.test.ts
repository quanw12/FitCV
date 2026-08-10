import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/types/auth"

import {
  expireStoredSession,
  getStoredSession,
  storeSession,
  subscribeToSessionExpired,
} from "./authSession"

const session: AuthSession = {
  accessToken: "access-token",
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

describe("session expiry notifications", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("clears storage and deduplicates concurrent expiry notifications", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToSessionExpired(listener)
    storeSession(session)

    expireStoredSession()
    expireStoredSession()

    expect(getStoredSession()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()

    storeSession(session)
    expireStoredSession()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})
