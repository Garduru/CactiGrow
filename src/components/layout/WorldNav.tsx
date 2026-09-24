import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { useSocialPanel } from '../../features/social/useSocialPanel'
import type { WorldLocationId, WorldLocationProjection } from '../../game-world/worldTypes'

type OpenSurface = 'travel' | null

interface WorldNavProps {
  sceneName: 'Farm' | 'Town'
  destinations?: readonly WorldLocationProjection[]
  onTravel?: (locationId: WorldLocationId) => void
}

export function WorldNav({
  sceneName,
  destinations,
  onTravel,
}: WorldNavProps) {
  const { activeTab, setActiveTab, chatDockExpanded, setChatDockExpanded } = useSocialPanel()
  const [openSurface, setOpenSurface] = useState<OpenSurface>(null)
  const containerRef = useRef<HTMLElement>(null)
  const chatToggleRef = useRef<HTMLButtonElement>(null)
  const travelToggleRef = useRef<HTMLButtonElement>(null)
  const travelPanelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (openSurface !== 'travel') return
    const panel = travelPanelRef.current
    const nav = containerRef.current
    const toggle = travelToggleRef.current
    if (!panel || !nav || !toggle) return
    // Keep natural centering unless the clipped world shell requires an edge inset.
    function positionPanel() {
      if (!panel || !nav || !toggle) return
      const bounds = nav.getBoundingClientRect()
      const trigger = toggle.getBoundingClientRect()
      const center = (trigger.left + trigger.right) / 2
      panel.style.maxWidth = `${Math.max(0, bounds.width - 16)}px`
      const halfWidth = panel.getBoundingClientRect().width / 2
      const safeCenter = Math.max(bounds.left + 8 + halfWidth, Math.min(center, bounds.right - 8 - halfWidth))
      panel.style.left = `calc(50% + ${safeCenter - center}px)`
    }
    const observer = new ResizeObserver(positionPanel)
    observer.observe(nav)
    observer.observe(panel)
    positionPanel()
    return () => observer.disconnect()
  }, [openSurface])

  useEffect(() => {
    if (!openSurface) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpenSurface(null)
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenSurface(null)
      requestAnimationFrame(() => travelToggleRef.current?.focus())
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [openSurface])

  useEffect(() => {
    if (!chatDockExpanded || openSurface) return
    function dismissChat(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      setChatDockExpanded(false)
      requestAnimationFrame(() => chatToggleRef.current?.focus())
    }
    document.addEventListener('keydown', dismissChat)
    return () => document.removeEventListener('keydown', dismissChat)
  }, [chatDockExpanded, openSurface, setChatDockExpanded])

  function handleChatToggle(event: MouseEvent<HTMLButtonElement>) {
    setOpenSurface(null)
    if (activeTab === 'friends') setActiveTab('world-chat')
    setChatDockExpanded(!chatDockExpanded)
    if (event.detail > 0) event.currentTarget.blur()
  }

  function toggleSurface(surface: Exclude<OpenSurface, null>) {
    const opening = openSurface !== surface
    setOpenSurface(opening ? surface : null)
    if (opening && window.matchMedia('(max-width: 900px)').matches) setChatDockExpanded(false)
  }

  return (
    <nav className="world-nav" ref={containerRef} aria-label={`${sceneName} world navigation`}>
      <button
        className="world-nav__control world-nav__chat"
        ref={chatToggleRef}
        type="button"
        aria-expanded={chatDockExpanded}
        aria-controls={chatDockExpanded ? 'world-chat-hud' : undefined}
        onClick={handleChatToggle}
      >
        Chat
      </button>

      <span className="world-nav__spacer" />

      {destinations && onTravel && (
        <div className="world-nav__group">
          <div className="world-nav__travel">
            <button
              className="world-nav__control"
              ref={travelToggleRef}
              type="button"
              aria-expanded={openSurface === 'travel'}
              aria-controls={openSurface === 'travel' ? 'world-travel-menu' : undefined}
              onClick={() => toggleSurface('travel')}
            >
              Travel
            </button>
            {openSurface === 'travel' && (
              <div ref={travelPanelRef} className="world-nav__popover world-travel" id="world-travel-menu" aria-label={`${sceneName} travel destinations`}>
                {destinations.map((destination) => (
                  <button
                    key={destination.id}
                    type="button"
                    onClick={() => {
                      setOpenSurface(null)
                      onTravel(destination.id)
                    }}
                  >
                    {destination.travelLabel ?? destination.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
