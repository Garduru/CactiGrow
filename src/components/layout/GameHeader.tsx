import { useLocalMinimap } from '../../game-world/LocalMinimapContext'
import '../../game-world/localMinimap.css'
import { worldInputBoundary } from './worldInputBoundary'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useFeaturePanel } from '../../features/menu/featurePanelState'
import { useGameState } from '../../game/useGameState'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { useSocialState } from '../../features/social/useSocialState'
import { useSocialPanel } from '../../features/social/useSocialPanel'
import { useOwnPublicSkills } from '../../features/progression/useOwnPublicSkills'
import { getTotalLevel } from '../../features/progression/publicSkills'
import { MenuDropdown } from './UtilityMenu'

export function GameHeader() {
  const { state } = useGameState()
  const grower = useGrowerAuthority()
  const { openFeature, feature, setTravelHost } = useFeaturePanel()
  const social = useSocialState()
  const chat = useSocialPanel()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const skills = useOwnPublicSkills()
  const total = skills ? getTotalLevel(skills) : null
  const name = social.state.status === 'ready' ? social.state.overview.ownProfile?.displayName : undefined
  const tokens = grower.state.authority === 'server'
    ? grower.state.status === 'ready' ? grower.state.projection.player.tokenBalance : null
    : state.player.tokens
  const map = useLocalMinimap()
  const isWorld = ['/play', '/town', '/world'].includes(location.pathname)

  useEffect(() => {
    if (!menuOpen) return
    function outside(event: PointerEvent) { if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setMenuOpen(false); toggleRef.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true) }
  }, [menuOpen])

  const { chatDockExpanded, setChatDockExpanded } = chat
  const profileOpen = social.profileTarget.open
  useEffect(() => {
    if (!chatDockExpanded || menuOpen || feature || profileOpen) return
    function dismissChat(event: KeyboardEvent) {
      if (event.key === 'Escape') setChatDockExpanded(false)
    }
    document.addEventListener('keydown', dismissChat)
    return () => document.removeEventListener('keydown', dismissChat)
  }, [chatDockExpanded, menuOpen, feature, profileOpen, setChatDockExpanded])

  function toggleChat() {
    setMenuOpen(false)
    if (chat.activeTab === 'friends') chat.setActiveTab('world-chat')
    if (isWorld) chat.setChatDockExpanded(!chat.chatDockExpanded)
    else if (chat.open) chat.closePanel()
    else chat.openPanel(chat.activeTab === 'friends' ? 'world-chat' : chat.activeTab)
  }
  return <header {...worldInputBoundary} className="game-header" inert={feature !== null}>
    <a className="skip-link" href="#main-content">Skip to game</a>
    <div className="game-header__inner">
      <div className="game-header__left">
        <button type="button" className="game-header__brand" aria-label={collapsed ? 'Expand HUD' : 'Collapse HUD'} aria-expanded={!collapsed} aria-controls="hud-controls"
          onClick={() => { setCollapsed(!collapsed); setMenuOpen(false) }}><img src="/assets/branding/cactigrow-logo.png" alt="CactiGrow" width="1536" height="1024" /></button>
        <button hidden={collapsed} className="hud-control game-header__chat" type="button" onClick={toggleChat} aria-label="Chat" aria-expanded={isWorld ? chat.chatDockExpanded : chat.open}>Chat</button>
      </div>
      <div id="hud-controls" className="game-header__controls" hidden={collapsed}>
        <div className="game-header__center">
          <span className="game-header__currency" aria-label="Currency">$ {tokens?.toLocaleString() ?? '-'}</span>
          <div className="game-header__inventory-group">
            <button type="button" className="game-header__player" title={name ?? 'Player'} onClick={() => { setMenuOpen(false); openFeature('profile') }} aria-label="Open own profile">
              <strong>{name ?? 'Player'}</strong><span>Lvl: {total ?? '-'}</span>
            </button>
            <button data-tutorial-target="inventory" className="game-header__backpack" type="button" onClick={() => { setMenuOpen(false); openFeature('inventory') }} aria-label="Inventory" title="Inventory">
              <img src="/assets/ui/icons/inventory-backpack.png" alt="" width="32" height="32" />
            </button>
          </div>
        </div>
        <div className="game-header__right">
          {(import.meta.env.MODE === 'staging' || import.meta.env.MODE === 'production') && location.pathname === '/world' && <button type="button" className="game-header__map" aria-label="Map" aria-expanded={map?.open ?? false} onClick={() => { setMenuOpen(false); map?.toggle() }}>Map</button>}
          <div ref={setTravelHost} className="game-header__travel" />
          <div className="game-header__menu" ref={menuRef}>
            <button ref={toggleRef} className="game-header__menu-toggle" type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls={menuOpen ? 'hud-menu-dropdown' : undefined} onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
            {menuOpen && <MenuDropdown onDismiss={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
    </div>
  </header>
}
