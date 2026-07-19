import { beforeEach, describe, expect, it } from "vitest"

import {
  clearStoredImprovementMatchResultId,
  getStoredImprovementMatchResultId,
  improvementMatchStorageKey,
  storeImprovementMatchResultId,
} from "./improvementSelection"

describe("improvement selection storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("stores and restores a numeric match ID for the same account", () => {
    storeImprovementMatchResultId("account-1", " 42 ")

    expect(getStoredImprovementMatchResultId("account-1")).toBe("42")
    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey("account-1"),
      ),
    ).toBe("42")
  })

  it("keeps selections isolated by account", () => {
    storeImprovementMatchResultId("account-1", "42")
    storeImprovementMatchResultId("account-2", "84")

    expect(getStoredImprovementMatchResultId("account-1")).toBe("42")
    expect(getStoredImprovementMatchResultId("account-2")).toBe("84")
  })

  it("clears invalid or explicitly invalidated selections", () => {
    const key = improvementMatchStorageKey("account-1")
    window.sessionStorage.setItem(key, "not-a-match-id")

    expect(getStoredImprovementMatchResultId("account-1")).toBeNull()
    expect(window.sessionStorage.getItem(key)).toBeNull()

    storeImprovementMatchResultId("account-1", "42")
    clearStoredImprovementMatchResultId("account-1")
    expect(getStoredImprovementMatchResultId("account-1")).toBeNull()
  })
})
