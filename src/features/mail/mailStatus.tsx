import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { browserApiClient } from '../../services/api/browserApiClient'

import { MailStatus } from './mailStatusContext'
export function MailStatusProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap()
  const playerId = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const [loaded, setLoaded] = useState<{ playerId: string; unread: number } | null>(null)
  useEffect(() => {
    if (!playerId) return
    const controller = new AbortController()
    let last = 0
    const refresh = () => {
      if (document.visibilityState === 'hidden' || Date.now() - last < 60_000) return
      last = Date.now()
      void browserApiClient.getUnreadMailCount(controller.signal).then(result => { if (!controller.signal.aborted) setLoaded({ playerId, unread: result.unreadCount }) }).catch(() => {})
    }
    refresh(); document.addEventListener('visibilitychange', refresh)
    return () => { controller.abort(); document.removeEventListener('visibilitychange', refresh) }
  }, [playerId])
  const setUnread = useCallback((unread: number) => { if (playerId) setLoaded({ playerId, unread }) }, [playerId])
  return <MailStatus.Provider value={{ unread: loaded?.playerId === playerId ? loaded?.unread ?? null : null,
    setUnread }}>{children}</MailStatus.Provider>
}
