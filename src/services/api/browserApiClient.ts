import { CactiGrowApiClient } from './CactiGrowApiClient'
import { createDevelopmentCredentials } from './developmentCredentials'

function developmentCredentials(): HeadersInit | undefined {
  return createDevelopmentCredentials(import.meta.env.DEV, window.location.search)
}

function apiBaseUrl() {
  const configured = import.meta.env.VITE_CACTIGROW_API_BASE_URL
  return typeof configured === 'string' ? configured.trim() : ''
}

export const browserApiClient = new CactiGrowApiClient({
  baseUrl: apiBaseUrl(),
  getCredentials: developmentCredentials,
})
