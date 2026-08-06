export type Theme = "light" | "dark"

const THEME_STORAGE_KEY = "fitcv-theme"

export function resolveTheme(): Theme {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (savedTheme === "light" || savedTheme === "dark") return savedTheme

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function initializeTheme() {
  const theme = resolveTheme()
  applyTheme(theme)
  return theme
}

export function persistTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}
