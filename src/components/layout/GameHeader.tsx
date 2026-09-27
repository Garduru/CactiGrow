import { CANONICAL_FARM_PATH } from '../../app/farmReturnNavigation'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGameState } from '../../game/useGameState'
import { ProgressBar } from '../ui/ProgressBar'
import { GameMenuPanel } from './UtilityMenu'
import { getProgressionSnapshot } from '../../features/progression/progressionModel'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { getDeploymentMode } from '../../config/deploymentMode'
import { getHeaderPlayerValues } from './headerPlayerModel'
import { useSocialPanel } from '../../features/social/useSocialPanel'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'

export function GameHeader() {
  const { state } = useGameState()
  const { player } = state
  const bootstrap = usePlayerBootstrap()
  const grower = useGrowerAuthority()
  const values = getHeaderPlayerValues(getDeploymentMode(), { cultivationXp: player.skills.cultivation.xp, tokens: player.tokens }, bootstrap.status === 'authenticated' ? bootstrap.bootstrap : null, grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection : null)
  const progression = getProgressionSnapshot(values.cultivationXp)

  const location = useLocation()
  const social = useSocialPanel()
  const isWorldRoute = [CANONICAL_FARM_PATH, '/farm', '/world-preview', '/town'].includes(location.pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [menuOpen])

  function dismissMenu() {
    setMenuOpen(false)
    toggleRef.current?.focus()
  }

  function openChat() {
    dismissMenu()
    const tab = social.activeTab === 'messages' ? 'messages' : 'world-chat'
    social.setActiveTab(tab)
    if (isWorldRoute) social.setChatDockExpanded(true)
    else { social.setChatDockExpanded(false); social.openPanel(tab) }
  }

  function openFriends() {
    dismissMenu()
    social.setChatDockExpanded(false)
    social.openPanel('friends')
  }

  return (
    <header className="game-header">
      <a className="skip-link" href="#main-content">Skip to game</a>
      <div className="game-header__inner">
        <Link className="game-header__brand" to={CANONICAL_FARM_PATH} aria-label="CactiGrow — Farm">
          <img src="/cactigrow-logo.png" alt="CactiGrow by CactiSwap" />
        </Link>

        <div className="game-header__stat">
          <span>Tokens</span>
          <strong>{values.tokens.toLocaleString()}</strong>
        </div>

        <div className="game-header__player">
          <div className="game-header__level">
            <div className="game-header__level-title">
              <strong><span className="game-header__skill-name">Cultivation </span>{progression.isMaxLevel ? 'Lv. 99 MAX' : `Lv. ${progression.level}`}</strong>
              <span>{player.username}</span>
            </div>

            {progression.isMaxLevel ? (
              <ProgressBar
                value={1}
                max={1}
                label="XP"
                displayValue="MAX"
                ariaLabel="Cultivation experience: maximum level"
                ariaValueText={`${progression.totalXp.toLocaleString()} total XP, maximum level`}
              />
            ) : (
              <ProgressBar
                value={progression.progressXp}
                max={progression.requiredXp}
                label="XP"
                ariaLabel={`Cultivation level ${progression.level} experience progress`}
                ariaValueText={`${progression.progressXp.toLocaleString()} of ${progression.requiredXp.toLocaleString()} Cultivation XP toward level ${progression.level + 1}; ${progression.totalXp.toLocaleString()} total XP`}
              />
            )}
          </div>
        </div>

        <Link className="game-header__backpack" to="/inventory" aria-label="Inventory" title="Inventory">
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">
            <path d="M7 9V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <rect x="3" y="9" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>

        <div className="game-header__menu" ref={menuRef}>
          <button
            className="game-header__menu-toggle"
            ref={toggleRef}
            type="button"
            title="Game Menu"
            onClick={() => { social.setChatDockExpanded(false); setMenuOpen((current) => !current) }}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'hud-game-menu' : undefined}
            aria-label={`${menuOpen ? 'Close' : 'Open'} game menu`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="4" r="1.5" fill="currentColor" />
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              <circle cx="10" cy="16" r="1.5" fill="currentColor" />
            </svg>
          </button>
          {menuOpen && (
            <GameMenuPanel
              id="hud-game-menu"
              onDismiss={dismissMenu}
              onOpenChat={openChat}
              onOpenFriends={openFriends}
            />
          )}
        </div>
      </div>
    </header>
  )
}
