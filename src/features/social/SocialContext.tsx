import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import type { SocialCommandV1 } from '../../../shared/api/socialV1'
import type { AreaConnection, AreaConnectionState } from '../../services/realtime/AreaConnection'
import { SocialContext, type SocialLoadState } from './socialContextState'

const EMPTY_TOWN_SNAPSHOT: AreaConnectionState = { status: 'idle', remotes: [], chatMessages: [] }
const subscribeWithoutTown: (listener: () => void) => () => void = () => () => {}
const getEmptyTownSnapshot = (): AreaConnectionState => EMPTY_TOWN_SNAPSHOT

export function SocialProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap()
  const playerId = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const [loadedSocial, setLoadedSocial] = useState<{ playerId: string; revision: number; state: Exclude<SocialLoadState, { status: 'loading' }> } | null>(null)
  const [reload, setReload] = useState(0)
  const [profileTarget, setProfileTarget] = useState<{ open: false } | { open: true; publicId: string | null }>({ open: false })
  const [townConnection, setTownConnection] = useState<AreaConnection | null>(null)
  const [directRecipientPublicId, setDirectRecipientPublicId] = useState<string | null>(null)
  const bindTownConnection = useCallback((connection: AreaConnection | null) => setTownConnection(connection), [])
  // Refreshing relationships must not tear down the authenticated game subtree.
  const state: SocialLoadState = playerId && loadedSocial?.playerId === playerId && (loadedSocial.state.status === 'ready' || loadedSocial.revision === reload)
    ? loadedSocial.state : { status: 'loading' }
  const townSubscribe = townConnection?.subscribe ?? subscribeWithoutTown
  const townSnapshot = townConnection?.getSnapshot ?? getEmptyTownSnapshot
  const realtime = useSyncExternalStore(townSubscribe, townSnapshot, getEmptyTownSnapshot)
  const chatStatus = !townConnection ? 'World Chat is available in Town.'
    : realtime.status === 'connected' ? 'Connected to Town Chat.'
      : realtime.status === 'reconnecting' ? 'Reconnecting to Town Chat…' : 'Connect to Town to chat.'
  const chatMessages = realtime.chatMessages
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
    openProfile, closeProfile, bindTownConnection, chatStatus, chatMessages,
    chatError, directRecipientPublicId, setDirectRecipient: setDirectRecipientPublicId,
    sendWorldMessage: (text) => townConnection?.sendWorldMessage(text) ?? false,
    sendDirectMessage: (text) => directRecipientPublicId ? townConnection?.sendDirectMessage(directRecipientPublicId, text) ?? false : false }}>
    {children}
  </SocialContext.Provider>
}
