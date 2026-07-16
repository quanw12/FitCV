export const DEFAULT_PRODUCTION_API_BASE_URL = 'https://fitcv-0cab.onrender.com'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_BASE_URL : '')

export function apiConnectionErrorMessage() {
  return `Cannot reach the FitCV backend at ${API_BASE_URL || 'the configured API URL'}. Check the backend, CORS, and database connection.`
}
