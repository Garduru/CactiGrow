import { useSyncExternalStore } from 'react'
import { usePlayerBootstrap } from '../app/usePlayerBootstrap'
import { useSocialState } from '../features/social/useSocialState'

export function useTownPresence() {
  const { connection } = useSocialState()
  const bootstrap = usePlayerBootstrap()
  const identity = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const enabled = (import.meta.env.MODE !== 'production' || import.meta.env.VITE_CACTIGROW_REALTIME_ENABLED === 'true') && !(import.meta.env.DEV && new URLSearchParams(window.location.search).has('worldEdit'))
  const status = useSyncExternalStore(connection.subscribe, () => connection.getSnapshot().status)
  return { connection, status: !identity ? 'Sign in for multiplayer' : ({ idle: 'Multiplayer unavailable', connecting: 'Connecting...',
    connected: 'Connected', reconnecting: 'Reconnecting...', unavailable: 'Multiplayer unavailable - re-enter Town to retry' } as const)[status], enabled }
}
