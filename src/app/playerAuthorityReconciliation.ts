import type { PlayerAuthorityRevisionV1 } from '../../shared/api/playerAuthorityRevisionV1.ts'

export const PLAYER_AUTHORITY_CHECK_INTERVAL_MS = 30_000
const FOCUS_COOLDOWN_MS = 5_000
const REQUEST_TIMEOUT_MS = 15_000

interface Dependencies {
  read(signal: AbortSignal): Promise<PlayerAuthorityRevisionV1>
  refreshGrower(signal: AbortSignal): Promise<boolean>
  refreshLifecycle(signal: AbortSignal): Promise<boolean>
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>
  now?: () => number
  schedule?: (callback: () => void, delay: number) => () => void
}

/** Observe revisions, then refetch existing projections. Never apply currency deltas. */
export function startPlayerAuthorityReconciliation(deps: Dependencies): () => void {
  const now = deps.now ?? Date.now
  const schedule = deps.schedule ?? ((callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer) })
  let stopped = false, denied = false, running = false
  let observed: PlayerAuthorityRevisionV1 | null = null
  let lastCheck = -Infinity
  let cancelTimer: (() => void) | undefined
  let controller: AbortController | undefined
  const visible = () => !stopped && !denied && deps.document.visibilityState === 'visible'
  const queue = (delay: number) => { cancelTimer?.(); if (visible()) cancelTimer = schedule(() => { void check() }, delay) }
  async function check() {
    if (!visible() || running) return
    running = true; lastCheck = now()
    const request = new AbortController(); controller = request
    const cancelDeadline = schedule(() => request.abort(), REQUEST_TIMEOUT_MS)
    try {
      const revision = await deps.read(request.signal)
      if (!visible() || request.signal.aborted) return
      // Keep profile and Grower counters separate: Math.max can hide a currency/XP change.
      const growerChanged = !observed || revision.profileVersion !== observed.profileVersion || revision.growerVersion !== observed.growerVersion
      const lifecycleChanged = !observed || revision.lifecycleVersion !== observed.lifecycleVersion
      const refreshed = await Promise.all([
        growerChanged ? deps.refreshGrower(request.signal) : true,
        lifecycleChanged ? deps.refreshLifecycle(request.signal) : true,
      ])
      // Failed, aborted or superseded reads must be retried, even with the same revision.
      if (visible() && !request.signal.aborted && refreshed.every(Boolean)) observed = revision
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) denied = true
      // Preserve loaded state on transient failures; retry at the bounded cadence.
    } finally {
      cancelDeadline(); controller = undefined; running = false
      queue(PLAYER_AUTHORITY_CHECK_INTERVAL_MS)
    }
  }
  const resume = () => {
    cancelTimer?.()
    if (!visible()) { controller?.abort(); return }
    if (!running) queue(Math.max(0, FOCUS_COOLDOWN_MS - (now() - lastCheck)))
  }
  deps.window.addEventListener('focus', resume)
  deps.document.addEventListener('visibilitychange', resume)
  // Initial providers already loaded; the first check closes the startup race without duplicate startup requests.
  queue(PLAYER_AUTHORITY_CHECK_INTERVAL_MS)
  return () => {
    stopped = true; cancelTimer?.(); controller?.abort()
    deps.window.removeEventListener('focus', resume)
    deps.document.removeEventListener('visibilitychange', resume)
  }
}
