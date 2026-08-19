import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearResourceCache,
  getCachedResource,
  getOrFetchResource,
  setCachedResource,
} from "./resourceCache"

describe("resourceCache", () => {
  beforeEach(() => {
    clearResourceCache()
  })

  it("calls the loader on initial cache miss", async () => {
    const loader = vi.fn().mockResolvedValue("first-value")

    const result = await getOrFetchResource("test-key", loader)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(result).toBe("first-value")
  })

  it("returns cached value without calling loader on second access", async () => {
    const loader = vi.fn().mockResolvedValue("cached-value")

    await getOrFetchResource("test-key", loader)

    const second = await getOrFetchResource("test-key", loader)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(second).toBe("cached-value")
  })

  it("getCachedResource returns undefined before first fetch and value after", async () => {
    expect(getCachedResource("snap")).toBeUndefined()

    const loader = vi.fn().mockResolvedValue({ count: 5 })
    await getOrFetchResource("snap", loader)

    expect(getCachedResource("snap")).toEqual({ count: 5 })
  })

  it("deduplicates in-flight requests", async () => {
    let resolveFirst: (value: string) => void = () => {}

    const loader = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve
        }),
    )

    const p1 = getOrFetchResource("dedup", loader)
    const p2 = getOrFetchResource("dedup", loader)

    expect(loader).toHaveBeenCalledTimes(1)

    resolveFirst("shared-result")

    expect(await p1).toBe("shared-result")
    expect(await p2).toBe("shared-result")
  })

  it("clearResourceCache() without prefix clears all keys", async () => {
    setCachedResource("a", 1)
    setCachedResource("b", 2)

    expect(getCachedResource("a")).toBe(1)
    expect(getCachedResource("b")).toBe(2)

    clearResourceCache()

    expect(getCachedResource("a")).toBeUndefined()
    expect(getCachedResource("b")).toBeUndefined()
  })

  it("clearResourceCache(prefix) only clears matching keys", () => {
    setCachedResource("hr-jobs:active", [1])
    setCachedResource("hr-jobs:archived", [2])
    setCachedResource("cv-history:versions", [3])

    clearResourceCache("hr-jobs:")

    expect(getCachedResource("hr-jobs:active")).toBeUndefined()
    expect(getCachedResource("hr-jobs:archived")).toBeUndefined()
    expect(getCachedResource("cv-history:versions")).toEqual([3])
  })

  it("prevents stale writes after clearResourceCache (generation guard)", async () => {
    let resolveStale: (value: string) => void = () => {}

    const staleLoader = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveStale = resolve
        }),
    )

    const stalePromise = getOrFetchResource("gen-key", staleLoader)

    // Clear cache while the first request is still in flight.
    clearResourceCache()

    // Now fetch again with a fresh loader.
    const freshLoader = vi.fn().mockResolvedValue("fresh-value")
    const freshResult = await getOrFetchResource("gen-key", freshLoader)

    expect(freshResult).toBe("fresh-value")

    // Resolve the stale request — it must NOT overwrite the fresh cache entry.
    resolveStale("stale-value")
    await stalePromise

    expect(getCachedResource("gen-key")).toBe("fresh-value")
  })

  it("force option bypasses cache and calls loader again", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2")

    await getOrFetchResource("force-key", loader)
    const forced = await getOrFetchResource("force-key", loader, {
      force: true,
    })

    expect(loader).toHaveBeenCalledTimes(2)
    expect(forced).toBe("v2")
  })

  it("simulates cached navigation: no skeleton flash on revisit", async () => {
    // First visit — cache miss, loader called.
    const loader = vi.fn().mockResolvedValue("page-data")
    await getOrFetchResource("nav-key", loader)

    // Second visit (cached navigation) — getCachedResource returns data
    // synchronously, so the screen can render immediately without a skeleton.
    const cached = getCachedResource("nav-key")

    expect(cached).toBe("page-data")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("simulates logout: clearResourceCache clears all screen caches", async () => {
    setCachedResource("seeker-cv-history", { cvs: [] })
    setCachedResource("hr-pipeline", { stages: [] })
    setCachedResource("hr-auto-email", { templates: [] })

    // Logout clears the entire cache.
    clearResourceCache()

    // Next visit after login must show skeletons (cache miss).
    expect(getCachedResource("seeker-cv-history")).toBeUndefined()
    expect(getCachedResource("hr-pipeline")).toBeUndefined()
    expect(getCachedResource("hr-auto-email")).toBeUndefined()
  })
})
