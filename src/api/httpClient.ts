import { getStoredSession } from './authSession'
import { API_BASE_URL } from './config'

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { authenticated = false, headers, ...init } = options
  const token = authenticated ? getStoredSession()?.accessToken : undefined
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(payload?.detail ?? `Request failed with status ${response.status}.`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
