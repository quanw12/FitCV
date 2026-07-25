const THEME_KEY = "fitcv-theme"

export type Theme = "light" | "dark"

export function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === "light" || stored === "dark") return stored
  return null
}

export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function toggleTheme(): Theme {
  const current = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"
  const next: Theme = current === "dark" ? "light" : "dark"
  setStoredTheme(next)
  return next
}
