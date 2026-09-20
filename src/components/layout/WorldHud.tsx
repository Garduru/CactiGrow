import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { InGameChatHud } from '../../features/social/InGameChatHud'
import { useSocialPanel } from '../../features/social/useSocialPanel'
import type { WorldLocationId, WorldLocationProjection } from '../../game-world/worldTypes'
import { GameMenuPanel } from './UtilityMenu'

interface WorldHudProps {
  sceneName: 'Farm' | 'Town'
  destinations: readonly WorldLocationProjection[]
  onTravel: (locationId: WorldLocationId) => void
}

type OpenSurface = 'travel' | 'menu' | null

export function WorldHud({ sceneName, destinations, onTravel }: WorldHudProps) {
  const { activeTab, openPanel, setActiveTab, chatDockExpanded, setChatDockExpanded } = useSocialPanel()
  const [openSurface, setOpenSurface] = useState<OpenSurface>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chatToggleRef = useRef<HTMLButtonElement>(null)
  const travelToggleRef = useRef<HTMLButtonElement>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!openSurface) return

    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpenSurface(null)
    }

    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const closingSurface = openSurface
      setOpenSurface(null)
      requestAnimationFrame(() => (closingSurface === 'travel' ? travelToggleRef : menuToggleRef).current?.focus())
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

  function toggleChat(event: MouseEvent<HTMLButtonElement>) {
    setOpenSurface(null)
    if (!chatDockExpanded && activeTab === 'friends') setActiveTab('messages')
    setChatDockExpanded(!chatDockExpanded)
    if (event.detail > 0) event.currentTarget.blur()
  }

  function showChat() {
    setOpenSurface(null)
    if (activeTab === 'friends') setActiveTab('messages')
    setChatDockExpanded(true)
  }

  function openFriends() {
    setOpenSurface(null)
    setChatDockExpanded(false)
    openPanel('friends')
  }

  function toggleSurface(surface: Exclude<OpenSurface, null>) {
    const opening = openSurface !== surface
    setOpenSurface(opening ? surface : null)
    if (opening && window.matchMedia('(max-width: 900px)').matches) setChatDockExpanded(false)
  }

  return (
    <div className="world-hud" ref={containerRef} aria-label={`${sceneName} world controls`}>
      {chatDockExpanded && (
        <InGameChatHud
          mode={activeTab === 'world-chat' ? 'world-chat' : 'messages'}
          onModeChange={setActiveTab}
        />
      )}
      <button
        className="world-hud__control world-hud__chat"
        ref={chatToggleRef}
        type="button"
        aria-expanded={chatDockExpanded}
        aria-controls={chatDockExpanded ? 'world-chat-hud' : undefined}
        onClick={toggleChat}
      >
        Chat
      </button>

      <div className="world-hud__center">
        {openSurface === 'travel' && (
          <nav className="world-hud__popover world-travel" id="world-travel-menu" aria-label={`${sceneName} travel destinations`}>
            <strong>Travel</strong>
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
          </nav>
        )}
        <button
          className="world-hud__control"
          ref={travelToggleRef}
          type="button"
          aria-expanded={openSurface === 'travel'}
          aria-controls={openSurface === 'travel' ? 'world-travel-menu' : undefined}
          onClick={() => toggleSurface('travel')}
        >
          Travel
        </button>
      </div>

      <div className="world-hud__right">
        {openSurface === 'menu' && (
          <GameMenuPanel
            id="world-game-menu"
            onDismiss={() => setOpenSurface(null)}
            onOpenChat={showChat}
            onOpenFriends={openFriends}
          />
        )}
        <button
          className="world-hud__control"
          ref={menuToggleRef}
          type="button"
          aria-expanded={openSurface === 'menu'}
          aria-controls={openSurface === 'menu' ? 'world-game-menu' : undefined}
          onClick={() => toggleSurface('menu')}
        >
          Game Menu
        </button>
      </div>
    </div>
  )
}
