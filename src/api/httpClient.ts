import {
  type BackendAuthSession,
  expireStoredSession,
  getStoredSession,
  persistBackendSession,
  SessionExpiredError,
} from "./authSession"

import { API_BASE_URL, apiConnectionErrorMessage } from "./config"

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
          if (response.status === 401) {
            expireStoredSession()
            return null
          }
          throw await errorFromResponse(response)
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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function detailMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail
  if (!Array.isArray(detail)) return null

  const messages = detail.flatMap((item) => {
    if (!item || typeof item !== "object" || !("msg" in item)) return []
    const message = item.msg
    if (typeof message !== "string") return []
    const location =
      "loc" in item && Array.isArray(item.loc)
        ? item.loc
            .filter((part: unknown) => part !== "body")
            .map(String)
            .join(".")
        : ""
    return [location ? `${location}: ${message}` : message]
  })
  return messages.length ? messages.join("; ") : null
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as {
    detail?: unknown
  } | null
  return new ApiError(
    detailMessage(payload?.detail) ??
      `Request failed with status ${response.status}.`,
    response.status,
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export async function requestResponse(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const { authenticated = false, headers, ...init } = options

  const requestHeaders = new Headers(headers)

  if (
    init.body != null &&
    !(init.body instanceof FormData) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json")
  }

  const send = async (token?: string) => {
    const nextHeaders = new Headers(requestHeaders)
    if (token) nextHeaders.set("Authorization", `Bearer ${token}`)
    else nextHeaders.delete("Authorization")
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        credentials: init.credentials ?? "include",
        headers: nextHeaders,
      })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new Error(apiConnectionErrorMessage())
    }
  }

  let response = await send(
    authenticated ? getStoredSession()?.accessToken : undefined,
  )

  if (
    authenticated &&
    response.status === 401 &&
    path !== "/api/auth/refresh"
  ) {
    const session = await refreshSession()
    if (!session) throw new SessionExpiredError()
    response = await send(session.accessToken)
  }

  if (authenticated && response.status === 401) {
    expireStoredSession()
    throw new SessionExpiredError()
  }

  if (!response.ok) throw await errorFromResponse(response)
  return response
}

export async function requestJson<T>(
  path: string,

  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await requestResponse(path, options)

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

export async function requestBlob(
  path: string,
  fallbackMessage: string,
): Promise<Blob> {
  try {
    const response = await requestResponse(path, { authenticated: true })
    return response.blob()
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.message.startsWith("Request failed")
    ) {
      throw new ApiError(fallbackMessage, error.status)
    }
    throw error
  }
}
