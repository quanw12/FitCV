import { expireStoredSession, getStoredSession } from "./authSession"
import { requestJson } from "./httpClient"

export const SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000
const ACTIVITY_REPORT_INTERVAL_MS = 60 * 1000
const LAST_ACTIVITY_KEY = "fitcv.auth.lastActivityAt"

function readLastActivity(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY)
    const value = raw ? Number(raw) : Number.NaN
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function writeLastActivity(value: number): void {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(value))
  } catch {
    // Backend vẫn là lớp bảo vệ chính nếu trình duyệt chặn localStorage.
  }
}

export function initializeSessionActivity(now = Date.now()): void {
  if (getStoredSession()) writeLastActivity(now)
}

export function startSessionActivityMonitoring(): () => void {
  let timer: number | undefined
  let stopped = false
  // A restored page must report its first real user action immediately. Otherwise
  // the backend can retain an older last_used_at while the browser has a new
  // local activity timestamp.
  let lastReportedAt: number | null = null

  const schedule = () => {
    if (timer !== undefined) window.clearTimeout(timer)
    if (stopped || !getStoredSession()) return

    let lastActivityAt = readLastActivity()
    if (lastActivityAt === null) {
      lastActivityAt = Date.now()
      writeLastActivity(lastActivityAt)
    }
    const remaining = SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt)
    if (remaining <= 0) {
      expireStoredSession()
      return
    }
    timer = window.setTimeout(checkIdle, remaining + 1)
  }

  const checkIdle = () => {
    if (stopped || !getStoredSession()) return
    const lastActivityAt = readLastActivity()
    if (
      lastActivityAt !== null &&
      Date.now() - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS
    ) {
      expireStoredSession()
      return
    }
    schedule()
  }

  const recordHumanActivity = () => {
    if (stopped || !getStoredSession()) return
    const now = Date.now()
    const previous = readLastActivity()
    if (previous !== null && now - previous >= SESSION_IDLE_TIMEOUT_MS) {
      expireStoredSession()
      return
    }

    writeLastActivity(now)
    schedule()
    if (
      lastReportedAt !== null &&
      now - lastReportedAt < ACTIVITY_REPORT_INTERVAL_MS
    ) {
      return
    }

    lastReportedAt = now
    void requestJson<void>("/api/auth/activity", {
      method: "POST",
      authenticated: true,
    }).catch(() => {
      // Lỗi mạng/5xx không được tự đăng xuất; 401 đã được HTTP client xử lý.
    })
  }

  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") return
    checkIdle()
    if (getStoredSession()) recordHumanActivity()
  }
  const onFocus = () => {
    checkIdle()
    if (getStoredSession()) recordHumanActivity()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_ACTIVITY_KEY) checkIdle()
  }

  const passiveCapture = { passive: true, capture: true }

  window.addEventListener("pointerdown", recordHumanActivity, passiveCapture)
  window.addEventListener("keydown", recordHumanActivity, true)
  window.addEventListener("touchstart", recordHumanActivity, passiveCapture)
  window.addEventListener("wheel", recordHumanActivity, passiveCapture)
  window.addEventListener("scroll", recordHumanActivity, passiveCapture)
  window.addEventListener("click", recordHumanActivity, true)
  window.addEventListener("input", recordHumanActivity, true)
  window.addEventListener("change", recordHumanActivity, true)
  document.addEventListener("scroll", recordHumanActivity, passiveCapture)
  window.addEventListener("focus", onFocus)
  window.addEventListener("storage", onStorage)
  document.addEventListener("visibilitychange", onVisibilityChange)
  checkIdle()

  return () => {
    stopped = true
    if (timer !== undefined) window.clearTimeout(timer)
    window.removeEventListener("pointerdown", recordHumanActivity, true)
    window.removeEventListener("keydown", recordHumanActivity, true)
    window.removeEventListener("touchstart", recordHumanActivity, true)
    window.removeEventListener("wheel", recordHumanActivity, true)
    window.removeEventListener("scroll", recordHumanActivity, true)
    window.removeEventListener("click", recordHumanActivity, true)
    window.removeEventListener("input", recordHumanActivity, true)
    window.removeEventListener("change", recordHumanActivity, true)
    document.removeEventListener("scroll", recordHumanActivity, true)
    window.removeEventListener("focus", onFocus)
    window.removeEventListener("storage", onStorage)
    document.removeEventListener("visibilitychange", onVisibilityChange)
  }
}
