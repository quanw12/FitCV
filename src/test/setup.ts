import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"

import { afterEach } from "vitest"

import { clearResourceCache } from "@/services/resourceCache"

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null

  readonly rootMargin = "0px"

  readonly thresholds: ReadonlyArray<number> = []

  disconnect() {}

  observe() {}

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  unobserve() {}
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,

  writable: true,

  value: IntersectionObserverMock,
})

const localStorageValues = new Map<string, string>()
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    clear: () => localStorageValues.clear(),
    getItem: (key: string) => localStorageValues.get(key) ?? null,
    key: (index: number) => [...localStorageValues.keys()][index] ?? null,
    get length() {
      return localStorageValues.size
    },
    removeItem: (key: string) => localStorageValues.delete(key),
    setItem: (key: string, value: string) =>
      localStorageValues.set(key, String(value)),
  } satisfies Storage,
})

afterEach(() => {
  cleanup()

  clearResourceCache()

  window.sessionStorage.clear()
  window.localStorage.clear()
})
