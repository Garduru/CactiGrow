import { useEffect } from 'react'
import { useGrowerAuthority } from './useGrowerAuthority'
import { usePlantLifecycle } from './usePlantLifecycle'
import { browserApiClient } from '../services/api/browserApiClient'
import { startPlayerAuthorityReconciliation } from './playerAuthorityReconciliation'

/** One session-owned observer, independent of routes, panels and Phaser. */
export function PlayerAuthorityReconciler() {
  const grower = useGrowerAuthority(), lifecycle = usePlantLifecycle()
  const playerId = grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection.player.playerId : null
  const ready = playerId !== null && lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready'
  const refreshGrower = grower.refresh, refreshLifecycle = lifecycle.refresh
  useEffect(() => {
    if (!ready) return
    return startPlayerAuthorityReconciliation({
      read: signal => browserApiClient.getPlayerAuthorityRevision(signal),
      refreshGrower, refreshLifecycle, document, window,
    })
  }, [ready, playerId, refreshGrower, refreshLifecycle])
  return null
}
