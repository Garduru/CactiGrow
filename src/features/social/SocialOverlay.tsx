import { worldInputBoundary } from '../../components/layout/worldInputBoundary'
import { useEffect, useRef } from 'react'
import { ChatPage } from './ChatPage'
import { useSocialPanel } from './useSocialPanel'
import type { SocialPanelTab } from './socialPanelState'
import { PlayerProfilePanel } from './PlayerProfilePanel'
import { useSocialState } from './useSocialState'
import { useChatViewport } from './useChatViewport'

const tabs: readonly { id: SocialPanelTab; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'messages', label: 'Messages' },
  { id: 'world-chat', label: 'World Chat' },
]

export function SocialOverlay() {
  const { open, activeTab, closePanel, openPanel } = useSocialPanel()
  const { profileTarget, closeProfile } = useSocialState()
  const isOpen = open || profileTarget.open
  const viewportRef = useChatViewport<HTMLDivElement>(false, isOpen)
  const close = profileTarget.open ? closeProfile : closePanel
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
      if (event.key === 'Tab') {
        const focusable = Array.from(document.querySelectorAll<HTMLElement>('.social-overlay__panel button:not(:disabled), .social-overlay__panel input:not(:disabled), .social-overlay__panel a[href]'))
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openerRef.current?.focus()
    }
  }, [isOpen, close])

  return isOpen && <div {...worldInputBoundary} ref={viewportRef} className={`social-overlay${!profileTarget.open && activeTab !== 'friends' ? ' social-overlay--chat' : ''}`} onPointerDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <section className="social-overlay__panel" role="dialog" aria-modal="true" aria-label={profileTarget.open ? 'Player profile' : 'Social'}>
        {profileTarget.open ? <PlayerProfilePanel publicId={profileTarget.publicId} onClose={closeProfile} /> : <>
          <header className="social-overlay__header"><strong>Social</strong><button ref={closeRef} type="button" onClick={closePanel} aria-label="Close Social panel">Close</button></header>
          <nav className="social-overlay__tabs" aria-label="Social sections">
            {tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => openPanel(tab.id)}>{tab.label}</button>)}
          </nav>
          <div className="social-overlay__content">
            <ChatPage selectedMode={activeTab === 'friends' ? 'world-chat' : activeTab} />
          </div>
        </>}
      </section>
    </div>
}
