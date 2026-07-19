import { getStoredSession } from './authSession'
import { API_BASE_URL } from './config'

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { authenticated = false, headers, ...init } = options
  const token = authenticated ? getStoredSession()?.accessToken : undefined
  const requestHeaders = new Headers(headers)

  if (init.body != null && !(init.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(payload?.detail ?? `Request failed with status ${response.status}.`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
