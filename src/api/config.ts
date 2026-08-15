export const DEFAULT_PRODUCTION_API_BASE_URL = "https://fitcv-0cab.onrender.com"

const DEFAULT_DEVELOPMENT_API_BASE_URL = ""
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL =
  import.meta.env.PROD
    ? configuredApiBaseUrl || DEFAULT_PRODUCTION_API_BASE_URL
    : DEFAULT_DEVELOPMENT_API_BASE_URL

export function apiConnectionErrorMessage(): string {
  const apiAddress =
    API_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "the current origin")

  return `Unable to reach the FitCV API at ${apiAddress}.`
}
