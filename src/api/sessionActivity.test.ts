import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/types/auth"

import {
  getStoredSession,
  storeSession,
  subscribeToSessionExpired,
} from "./authSession"
import {
  initializeSessionActivity,
  startSessionActivityMonitoring,
} from "./sessionActivity"

const requestMocks = vi.hoisted(() => ({ requestJson: vi.fn() }))
vi.mock("./httpClient", () => requestMocks)

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

describe("human idle monitoring", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T08:00:00Z"))
    window.localStorage.clear()
    window.sessionStorage.clear()
    requestMocks.requestJson.mockResolvedValue(undefined)
    storeSession(session)
    initializeSessionActivity()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("expires after one hour without human activity", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToSessionExpired(listener)
    const stop = startSessionActivityMonitoring()

    vi.advanceTimersByTime(60 * 60 * 1000 + 1)

    expect(getStoredSession()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    stop()
    unsubscribe()
  })

  it("slides the deadline from pointer activity and reports it at most once a minute", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToSessionExpired(listener)
    const stop = startSessionActivityMonitoring()

    vi.advanceTimersByTime(30 * 60 * 1000)
    window.dispatchEvent(new Event("pointerdown"))
    window.dispatchEvent(new Event("keydown"))
    expect(requestMocks.requestJson).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(50 * 60 * 1000)
    expect(getStoredSession()).toEqual(session)

    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(getStoredSession()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    stop()
    unsubscribe()
  })
})
