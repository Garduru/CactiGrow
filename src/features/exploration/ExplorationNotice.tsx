import { useExploration } from './ExplorationContext'

export function ExplorationNotice() {
  const exploration = useExploration(), notice = exploration.notice
  if (!notice) return null
  return <aside className="exploration-notice" role="status" aria-live="polite" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
    <div><strong>{notice.title}</strong>{notice.detail && <p>{notice.detail}</p>}{notice.retryable && <button className="cg-button exploration-notice__retry" disabled={exploration.pending} onClick={() => void exploration.retryNotice()}>{notice.retryLabel ?? 'Retry discovery'}</button>}</div>
    <button type="button" aria-label="Dismiss exploration notification" onClick={exploration.dismissNotice}>×</button>
  </aside>
}
