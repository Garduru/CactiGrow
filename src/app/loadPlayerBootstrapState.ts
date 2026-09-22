import { CactiGrowApiError, type CactiGrowApiClient } from '../services/api/CactiGrowApiClient.ts'
import type { PlayerBootstrapState } from './PlayerBootstrapContext.ts'

export async function loadPlayerBootstrapState(
  client: CactiGrowApiClient,
  signal?: AbortSignal,
  stagingGrower = false,
): Promise<PlayerBootstrapState> {
  try {
    const { bootstrap, requestId } = stagingGrower
      ? await client.getGrowerBootstrap(signal)
      : await client.getPlayerBootstrap(signal)
    return { status: 'authenticated', bootstrap, requestId }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof CactiGrowApiError && error.kind === 'unauthenticated') {
      return { status: 'unauthenticated', requestId: error.requestId }
    }
    if (error instanceof CactiGrowApiError) {
      return { status: 'error', message: error.message, requestId: error.requestId }
    }
    return { status: 'error', message: 'Unable to establish the CactiGrow player session.' }
  }
}
