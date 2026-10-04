import { ChatHistory } from './ChatHistory'
import { useLocation } from 'react-router-dom'
import { browserRealtimeApiClient } from '../../services/api/browserApiClient'
import { areaId } from '../../../shared/realtime/identifiers'
import { getChatLocation } from '../../../shared/realtime/chatLocation'
import { resolveTownSpawnId } from '../../app/farmReturnNavigation'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import type { SocialCommandV1 } from '../../../shared/api/socialV1'
import { AreaConnection, type AreaConnectionState } from '../../services/realtime/AreaConnection'
import { SocialContext, type SocialLoadState } from './socialContextState'

const EMPTY_TOWN_SNAPSHOT: AreaConnectionState = { status: 'idle', remotes: [], chatMessages: [] }
const getEmptyTownSnapshot = (): AreaConnectionState => EMPTY_TOWN_SNAPSHOT

export function SocialProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap()
  const playerId = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const [loadedSocial, setLoadedSocial] = useState<{ playerId: string; revision: number; state: Exclude<SocialLoadState, { status: 'loading' }> } | null>(null)
  const [reload, setReload] = useState(0)
  const [profileTarget, setProfileTarget] = useState<{ open: false } | { open: true; publicId: string | null }>({ open: false })
  const location = useLocation()
  const [directRecipientPublicId, setDirectRecipientPublicId] = useState<string | null>(null)
  // Refreshing relationships must not tear down the authenticated game subtree.
  const state: SocialLoadState = playerId && loadedSocial?.playerId === playerId && (loadedSocial.state.status === 'ready' || loadedSocial.revision === reload)
    ? loadedSocial.state : { status: 'loading' }
  const ownPublicId = state.status === 'ready' ? state.overview.ownProfile?.publicId : undefined
  const inTown = ['/town', '/shop', '/market'].includes(location.pathname)
  const currentAreaId = inTown ? 'town' : ownPublicId ? `farm-${ownPublicId}` : null
  const entryPointId = inTown ? resolveTownSpawnId(location.state) : 'chat-session'
  const townConnection = useMemo(() => new AreaConnection({ areaId: areaId(currentAreaId ?? 'town'), entryPointId,
    origin: window.location.origin, admit: (request, signal) => browserRealtimeApiClient.requestRealtimeAdmission(request, signal) }), [currentAreaId, entryPointId])
  const enabled = (import.meta.env.MODE !== 'production' || import.meta.env.VITE_CACTIGROW_REALTIME_ENABLED === 'true')
    && !(import.meta.env.DEV && new URLSearchParams(location.search).has('worldEdit'))
  useEffect(() => {
    if (enabled && playerId && ownPublicId && currentAreaId) townConnection.start()
    return () => townConnection.stop()
  }, [townConnection, enabled, playerId, ownPublicId, currentAreaId])
  const realtime = useSyncExternalStore(townConnection.subscribe, townConnection.getSnapshot, getEmptyTownSnapshot)
  const chatStatus = realtime.status === 'connected' ? 'Connected' : realtime.status === 'reconnecting' ? 'Reconnecting...' : 'Realtime chat unavailable.'
  const history = useMemo(() => new ChatHistory(playerId), [playerId])
  useEffect(() => history.attach(townConnection), [history, townConnection])
  const chatMessages = useSyncExternalStore(history.subscribe, history.getSnapshot)
  const chatError = realtime.chatError ?? ''

  useEffect(() => {
    if (!playerId) return
    const controller = new AbortController()
    void browserApiClient.getSocial(controller.signal).then((overview) => {
      if (!controller.signal.aborted) setLoadedSocial({ playerId, revision: reload, state: { status: 'ready', overview } })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : 'Social services are unavailable.'
      const sessionDenied = error instanceof CactiGrowApiError && error.kind === 'unauthenticated'
      setLoadedSocial((previous) => ({ playerId, revision: reload,
        state: !sessionDenied && previous?.playerId === playerId && previous.state.status === 'ready'
          ? { ...previous.state, refreshError: message } : { status: 'error', message } }))
    })
    return () => controller.abort()
  }, [playerId, reload])

  const mutate = useCallback(async (command: SocialCommandV1) => {
    let overview
    try { overview = await browserApiClient.mutateSocial(command) }
    catch (error) {
      if (error instanceof CactiGrowApiError && error.status === 409) {
        // A relationship may have changed on the other account since this panel opened.
        try {
          const current = await browserApiClient.getSocial()
          if (playerId) setLoadedSocial({ playerId, revision: reload, state: { status: 'ready', overview: current } })
        } catch { /* Preserve the original, useful conflict response. */ }
      }
      throw error
    }
    if (playerId) setLoadedSocial({ playerId, revision: reload, state: { status: 'ready', overview } })
    if (command.type === 'set-display-name' || command.type === 'block-player' || command.type === 'unblock-player') townConnection?.refreshPresence()
  }, [playerId, reload, townConnection])
  const refresh = useCallback(() => setReload((value) => value + 1), [])
  const openProfile = useCallback((publicId: string | null) => setProfileTarget({ open: true, publicId }), [])
  const closeProfile = useCallback(() => setProfileTarget({ open: false }), [])

  return <SocialContext.Provider value={{ state, mutate, refresh, profileTarget,
    openProfile, closeProfile, connection: townConnection, chatLocation: currentAreaId ? getChatLocation(currentAreaId) ?? null : null, chatConnected: realtime.status === 'connected', chatStatus, chatMessages,
    chatError, directRecipientPublicId, setDirectRecipient: setDirectRecipientPublicId,
    sendPublicMessage: (channel, text) => townConnection.sendPublicMessage(channel, text),
    sendWorldMessage: (text) => townConnection?.sendWorldMessage(text) ?? false,
    sendDirectMessage: (text) => directRecipientPublicId ? townConnection?.sendDirectMessage(directRecipientPublicId, text) ?? false : false }}>
    {children}
  </SocialContext.Provider>
}
