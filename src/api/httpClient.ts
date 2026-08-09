import {
  type BackendAuthSession,
  clearStoredSession,
  getStoredSession,
  persistBackendSession,
} from "./authSession"

import { API_BASE_URL } from "./config"

let refreshInFlight: Promise<ReturnType<typeof persistBackendSession> | null> | null =
  null

export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          clearStoredSession()
          return null
        }
        return persistBackendSession(
          (await response.json()) as BackendAuthSession,
        )
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
}

export async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { authenticated = false, headers, ...init } = options

  const requestHeaders = new Headers(headers)

  if (
    init.body != null &&
    !(init.body instanceof FormData) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json")
  }

  const send = (token?: string) => {
    const nextHeaders = new Headers(requestHeaders)
    if (token) nextHeaders.set("Authorization", `Bearer ${token}`)
    else nextHeaders.delete("Authorization")
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
      headers: nextHeaders,
    })
  }

  let response = await send(
    authenticated ? getStoredSession()?.accessToken : undefined,
  )

  if (authenticated && response.status === 401 && path !== "/api/auth/refresh") {
    const session = await refreshSession()
    if (session) {
      response = await send(session.accessToken)
    }
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string
    } | null

    throw new Error(
      payload?.detail ?? `Request failed with status ${response.status}.`,
    )
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}
