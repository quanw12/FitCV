import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"

import { afterEach } from "vitest"

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

afterEach(() => {
  cleanup()

  window.sessionStorage.clear()
})
