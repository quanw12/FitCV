const IMPROVEMENT_MATCH_STORAGE_PREFIX = "fitcv:improvement-match"

function canUseSessionStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  )
}

export function improvementMatchStorageKey(accountId: string): string {
  return `${IMPROVEMENT_MATCH_STORAGE_PREFIX}:${accountId}`
}

export function getStoredImprovementMatchResultId(
  accountId: string,
): string | null {
  if (!canUseSessionStorage()) return null

  const key = improvementMatchStorageKey(accountId)
  const matchResultId = window.sessionStorage.getItem(key)?.trim()

  if (!matchResultId || !/^\d+$/.test(matchResultId)) {
    window.sessionStorage.removeItem(key)
    return null
  }

  return matchResultId
}

export function storeImprovementMatchResultId(
  accountId: string,
  matchResultId: string,
): void {
  if (!canUseSessionStorage()) return

  const normalizedId = matchResultId.trim()
  const key = improvementMatchStorageKey(accountId)

  if (!/^\d+$/.test(normalizedId)) {
    window.sessionStorage.removeItem(key)
    return
  }

  window.sessionStorage.setItem(key, normalizedId)
}

export function clearStoredImprovementMatchResultId(accountId: string): void {
  if (!canUseSessionStorage()) return
  window.sessionStorage.removeItem(improvementMatchStorageKey(accountId))
}
