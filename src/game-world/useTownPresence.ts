import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { usePlayerBootstrap } from '../app/usePlayerBootstrap'
import { browserRealtimeApiClient } from '../services/api/browserApiClient'
import { AreaConnection } from '../services/realtime/AreaConnection'
import { TOWN_AREA } from '../../shared/realtime/areas'
import type { TownWorldSpawnId } from './worldTypes'

export function useTownPresence(entryPointId: TownWorldSpawnId) {
  const bootstrap = usePlayerBootstrap()
  const identity = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const enabled = import.meta.env.MODE !== 'production' && !(import.meta.env.DEV && new URLSearchParams(window.location.search).has('worldEdit'))
  const connection = useMemo(() => new AreaConnection({ areaId: TOWN_AREA.areaId, entryPointId, origin: window.location.origin,
    admit: (request, signal) => browserRealtimeApiClient.requestRealtimeAdmission(request, signal) }), [entryPointId])
  const status = useSyncExternalStore(connection.subscribe, () => connection.getSnapshot().status)
  useEffect(() => {
    if (enabled && identity) connection.start()
    return () => connection.stop()
  }, [connection, enabled, identity])
  return { connection, status: !identity ? 'Sign in for multiplayer' : ({ idle: 'Multiplayer unavailable', connecting: 'Connecting…',
    connected: 'Connected', reconnecting: 'Reconnecting…', unavailable: 'Multiplayer unavailable — re-enter Town to retry' } as const)[status], enabled }
}
