import { CactiGrowApiClient } from './CactiGrowApiClient'
import { createDevelopmentCredentials } from './developmentCredentials'

const developmentCredentials = import.meta.env.MODE === 'development'
  ? (): HeadersInit | undefined => createDevelopmentCredentials(true, window.location.search)
  : (): undefined => undefined

function apiBaseUrl() {
  const configured = import.meta.env.VITE_CACTIGROW_API_BASE_URL
  return typeof configured === 'string' ? configured.trim() : ''
}

export const browserApiClient = new CactiGrowApiClient({
  baseUrl: apiBaseUrl(),
  getCredentials: developmentCredentials,
})
