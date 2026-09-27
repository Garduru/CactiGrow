import { CactiGrowApiClient } from './CactiGrowApiClient'
import { createDevelopmentCredentials } from './developmentCredentials'

const developmentCredentials = import.meta.env.MODE === 'development'
  ? (): HeadersInit | undefined => createDevelopmentCredentials(true, window.location.search)
  : (): undefined => undefined

function apiBaseUrl() {
  if (import.meta.env.MODE !== 'development') return ''
  const configured = import.meta.env.VITE_CACTIGROW_API_BASE_URL
  return typeof configured === 'string' ? configured.trim() : ''
}

export const browserApiClient = new CactiGrowApiClient({
  baseUrl: apiBaseUrl(),
  getCredentials: developmentCredentials,
})

// Capture the explicit development selection at bootstrap, before navigation drops the query.
// Realtime must use the page's own origin; L3 deliberately rejects cross-origin admission.
const realtimeDevelopmentCredentials = import.meta.env.MODE === 'development'
  ? createDevelopmentCredentials(true, window.location.search) : undefined
export const browserRealtimeApiClient = new CactiGrowApiClient({ getCredentials: () => realtimeDevelopmentCredentials })
