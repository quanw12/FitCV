import type { Portal } from "@/types/app"

function storageKey(portal: Portal, accountId: string): string {
  const safeId = accountId.trim() || "guest"
  return `fitcv.onboarding_completed.${portal}.${safeId}`
}

function stepsKey(portal: Portal, accountId: string): string {
  const safeId = accountId.trim() || "guest"
  return `fitcv.onboarding_steps.${portal}.${safeId}`
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

export function getCompletedSteps(portal: Portal, accountId: string): number[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return []
  }
  try {
    const raw = window.localStorage.getItem(stepsKey(portal, accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number) : []
  } catch {
    return []
  }
}

export function markStepsCompleted(
  portal: Portal,
  accountId: string,
  stepIndexes: number[],
): number[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return stepIndexes
  }
  try {
    const existing = new Set(getCompletedSteps(portal, accountId))
    for (const idx of stepIndexes) {
      existing.add(idx)
    }
    const result = Array.from(existing)
    window.localStorage.setItem(stepsKey(portal, accountId), JSON.stringify(result))
    return result
  } catch {
    return stepIndexes
  }
}
