import { useEffect, useRef } from 'react'
import { FriendsPage } from './FriendsPage'
import { ChatPage } from './ChatPage'
import { useSocialPanel } from './useSocialPanel'
import type { SocialPanelTab } from './socialPanelState'

const tabs: readonly { id: SocialPanelTab; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'messages', label: 'Messages' },
  { id: 'world-chat', label: 'World Chat' },
]

export function SocialOverlay() {
  const { open, activeTab, closePanel, setActiveTab } = useSocialPanel()
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closePanel()
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
  }, [open, closePanel])

  return open && <div className="social-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) closePanel() }}>
      <section className="social-overlay__panel" role="dialog" aria-modal="true" aria-label="Social">
        <header className="social-overlay__header"><strong>Social</strong><button ref={closeRef} type="button" onClick={closePanel} aria-label="Close Social panel">Close</button></header>
        <nav className="social-overlay__tabs" aria-label="Social sections">
          {tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </nav>
        <div className="social-overlay__content">
          {activeTab === 'friends' ? <FriendsPage /> : <ChatPage selectedMode={activeTab === 'messages' ? 'direct' : 'world'} />}
        </div>
      </section>
    </div>
}
