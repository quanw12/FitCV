import type { Portal } from "@/types/app"

function storageKey(portal: Portal, accountId: string): string {
  const safeId = accountId.trim() || "guest"
  return `fitcv.onboarding_completed.${portal}.${safeId}`
}

export function isOnboardingCompleted(portal: Portal, accountId: string): boolean {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return false
  }
  try {
    return window.localStorage.getItem(storageKey(portal, accountId)) === "true"
  } catch {
    return false
  }
}

export function setOnboardingCompleted(
  portal: Portal,
  accountId: string,
  completed = true,
): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return
  }
  try {
    if (completed) {
      window.localStorage.setItem(storageKey(portal, accountId), "true")
    } else {
      window.localStorage.removeItem(storageKey(portal, accountId))
    }
  } catch {
    // Ignore storage quota/security errors in strict privacy modes
  }
}
