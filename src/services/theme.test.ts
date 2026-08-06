import { afterEach, describe, expect, it, vi } from "vitest"

import { initializeTheme, resolveTheme } from "./theme"

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  })
})

describe("theme preferences", () => {
  it("uses the browser preference when the user has not selected a theme", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })

    expect(resolveTheme()).toBe("dark")
  })

  it("applies a saved user preference before the app renders", () => {
    window.localStorage.setItem("fitcv-theme", "light")

    expect(initializeTheme()).toBe("light")
    expect(document.documentElement.dataset.theme).toBe("light")
  })
})
