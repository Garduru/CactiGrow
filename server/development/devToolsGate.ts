import type { WorkerEnv } from '../env.ts'
import { ApiError } from '../api/errors.ts'

/** The remote development Hyperdrive shares production data. Only the existing
 * isolated local database or explicitly protected staging may run dev commands. */
export function assertDevToolsEnvironment(env: WorkerEnv, requestUrl: string) {
  const host = new URL(requestUrl).hostname.toLowerCase()
  if (host === 'cactigrow.com' || host === 'www.cactigrow.com') throw ApiError.notFound('API route not found.')
  if (env.CACTIGROW_ENVIRONMENT === 'staging' && env.CACTIGROW_ACCESS_TEAM_DOMAIN && env.CACTIGROW_ACCESS_AUDIENCE) return
  if (env.CACTIGROW_ENVIRONMENT === 'development') {
    try {
      const database = new URL(env.HYPERDRIVE?.connectionString ?? '')
      if (['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) && database.pathname === '/cactigrow_local') return
    } catch { /* Unknown database targets fail closed. */ }
  }
  throw ApiError.notFound('API route not found.')
}
