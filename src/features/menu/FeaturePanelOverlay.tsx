import { worldInputBoundary } from '../../components/layout/worldInputBoundary'
import { useEffect, useRef } from 'react'
import { useSocialPanel } from '../social/useSocialPanel'
import { useSocialState } from '../social/useSocialState'
import { useChatViewport } from '../social/useChatViewport'
import { useAdminViewport } from '../admin/useAdminViewport'
import { FeatureContent } from './FeatureContent'
import { featureTitles, useFeaturePanel } from './featurePanelState'

export function FeaturePanelOverlay() {
  const { feature, closeFeature, worldPreview } = useFeaturePanel()
  const preview = feature === 'devtools' && worldPreview
  const open = feature !== null
  const { profileTarget } = useSocialState()
  const { open: socialOpen } = useSocialPanel()
  const admin = feature === 'admintools'
  const viewportRef = useChatViewport<HTMLDivElement>(false, open && !admin)
  const adminViewportRef = useAdminViewport(admin)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const covered = profileTarget.open || socialOpen

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => { if (opener?.isConnected) opener.focus(); else document.querySelector<HTMLButtonElement>('.game-header__menu-toggle')?.focus() }
  }, [open])

  useEffect(() => {
    if (!open || covered) return
    function keydown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeFeature() }
      if (event.key !== 'Tab' || preview) return
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]') ?? [])
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [open, covered, closeFeature, preview])

  return feature && <div {...worldInputBoundary} ref={admin ? adminViewportRef : viewportRef} className={`feature-overlay${admin ? ' feature-overlay--admin' : ''}${preview ? ' feature-overlay--dev-preview' : ''}`} onPointerDown={(event) => { if (admin) event.stopPropagation(); if (!preview && event.target === event.currentTarget) closeFeature() }}>
    <section ref={panelRef} className={`feature-panel feature-panel--${feature}`} role="dialog" aria-modal={!covered && !preview} aria-labelledby="feature-panel-title" inert={covered}>
      <header className="feature-panel__header"><h2 id="feature-panel-title">{featureTitles[feature]}</h2>
        <button ref={closeRef} type="button" onClick={closeFeature} aria-label="Close feature panel">Close</button>
      </header>
      <div key={feature} className="feature-panel__content location-page__content">
        <FeatureContent feature={feature} />
      </div>
    </section>
  </div>
}
