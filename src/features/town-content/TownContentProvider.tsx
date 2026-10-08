import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TOWN_NPC_IDS, type TownContentCommandV1, type TownContentProjectionV1, type TownContentResultV1, type TownNpcId } from '../../../shared/api/townContentV1.ts'
import type { WorldPoint } from '../../../shared/world/types.ts'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { TownContentContext } from './TownContentContext'
import './townContent.css'

/** First contacts are server records. Dialogue choices remain local to this player. */
export function TownContentProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap(), world = useWorldLocation()
  const active = import.meta.env.MODE === 'staging'
  const playerId = active && bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const [loaded, setLoaded] = useState<{ playerId: string; projection: TownContentProjectionV1 } | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const [renderedPlayer, setRenderedPlayer] = useState(playerId)
  if (renderedPlayer !== playerId) {
    setRenderedPlayer(playerId); setLoaded(null); setPending(false); setError('')
  }
  const identity = useRef(playerId), latest = useRef<typeof loaded>(null), generation = useRef(0), session = useRef(0)
  const retry = useRef(new Map<TownNpcId, TownContentCommandV1>())
  const queue = useRef(new Map<TownNpcId, Promise<TownContentResultV1 | null>>()), tail = useRef<Promise<void>>(Promise.resolve())
  const apply = useCallback((result: TownContentResultV1, epoch: number) => {
    if (!playerId || identity.current !== playerId || session.current !== epoch || latest.current?.playerId === playerId && latest.current.projection.revision > result.projection.revision) return
    generation.current += 1
    latest.current = { playerId, projection: result.projection }; setLoaded(latest.current); setError('')
  }, [playerId])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!playerId) return
    const request = ++generation.current, epoch = session.current
    try {
      const result = await browserApiClient.getTownContent(signal)
      if (!signal?.aborted && identity.current === playerId && session.current === epoch && request === generation.current) apply(result, epoch)
    } catch (reason) { if (!signal?.aborted && identity.current === playerId && session.current === epoch && request === generation.current) setError(reason instanceof Error ? reason.message : 'Town notes unavailable.') }
  }, [playerId, apply])
  // One authenticated session read also makes the small Journal note available outside Town.
  useEffect(() => {
    identity.current = playerId; latest.current = null; retry.current.clear(); generation.current += 1; session.current += 1; queue.current.clear(); tail.current = Promise.resolve()
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => { controller.abort(); generation.current += 1; session.current += 1 }
  }, [playerId, refresh])
  const talk = useCallback((entityId: TownNpcId, position: WorldPoint): Promise<TownContentResultV1 | null> => {
    if (!playerId || !world.location || !TOWN_NPC_IDS.includes(entityId)) return Promise.resolve(null)
    if (latest.current?.playerId === playerId && latest.current.projection.contacts.some(contact => contact.entityId === entityId && contact.firstMetAt)) return Promise.resolve({ projection: latest.current.projection, firstContact: false })
    const queued = queue.current.get(entityId)
    if (queued) return queued
    const epoch = session.current
    const previous = retry.current.get(entityId)
    const command: TownContentCommandV1 = previous?.expectedWorldRevision === world.location.revision ? previous : {
      v: 1, commandId: crypto.randomUUID(), type: 'talk', entityId, expectedWorldRevision: world.location.revision, position,
    }
    // At most three first-contact saves. They retain their real interaction point,
    // survive dialogue close, and serialize trusted reach updates; walking never queues.
    const task = tail.current.then(async () => {
      try {
        if (identity.current !== playerId || session.current !== epoch) return null
        if (latest.current?.playerId === playerId && latest.current.projection.contacts.some(contact => contact.entityId === entityId && contact.firstMetAt)) return { projection: latest.current.projection, firstContact: false }
        retry.current.set(entityId, command)
        const result = await browserApiClient.townContentCommand(command)
        if (identity.current !== playerId || session.current !== epoch) return null
        retry.current.delete(entityId); apply(result, epoch); return result
      } catch (reason) {
        if (identity.current === playerId && session.current === epoch) {
          setError(reason instanceof Error ? reason.message : 'Town conversation could not be recorded.')
          if (reason instanceof CactiGrowApiError && reason.status && reason.status >= 400 && reason.status < 500) retry.current.delete(entityId)
        }
        return null
      } finally {
        if (identity.current === playerId && session.current === epoch && queue.current.get(entityId) === task) {
          queue.current.delete(entityId); setPending(queue.current.size > 0)
        }
      }
    })
    queue.current.set(entityId, task); tail.current = task.then(() => {}, () => {})
    setPending(true); setError('')
    return task
  }, [playerId, world.location, apply])
  return <TownContentContext.Provider value={{ active, projection: loaded?.playerId === playerId ? loaded.projection : null, pending, error, refresh, talk }}>{children}</TownContentContext.Provider>
}
