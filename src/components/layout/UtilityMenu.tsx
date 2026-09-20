import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSocialPanel } from '../../features/social/useSocialPanel'

type MenuSection = 'game' | 'social' | 'other'

interface GameMenuPanelProps {
  id: string
  onDismiss: () => void
  onOpenChat: () => void
  onOpenFriends: () => void
}

export function GameMenuPanel({ id, onDismiss, onOpenChat, onOpenFriends }: GameMenuPanelProps) {
  const [openSection, setOpenSection] = useState<MenuSection | null>('game')

  function toggleSection(section: MenuSection) {
    setOpenSection((current) => current === section ? null : section)
  }

  return (
    <div className="utility-menu__panel" id={id} aria-label="Game menu">
      <MenuDisclosure label="Game" section="game" openSection={openSection} onToggle={toggleSection}>
        <Link to="/skills" onClick={onDismiss}>Skills</Link>
        <Link to="/journal" onClick={onDismiss}>Field Journal</Link>
        <Link to="/research" onClick={onDismiss}>Research Log</Link>
        <Link to="/achievements" onClick={onDismiss}>Achievements</Link>
      </MenuDisclosure>

      <MenuDisclosure label="Social" section="social" openSection={openSection} onToggle={toggleSection}>
        <button type="button" onClick={onOpenFriends}>Friends</button>
        <button type="button" onClick={onOpenChat}>Chat</button>
      </MenuDisclosure>

      <button className="utility-menu__standalone" type="button" aria-disabled="true" title="Coming soon">Settings</button>

      <MenuDisclosure label="Other" section="other" openSection={openSection} onToggle={toggleSection}>
        <button type="button" aria-disabled="true" title="Coming soon">Help</button>
        <button type="button" aria-disabled="true" title="Coming soon">Visit CactiSwap</button>
      </MenuDisclosure>
    </div>
  )
}

function MenuDisclosure({ label, section, openSection, onToggle, children }: {
  label: string
  section: MenuSection
  openSection: MenuSection | null
  onToggle: (section: MenuSection) => void
  children: ReactNode
}) {
  const expanded = openSection === section
  const panelId = `game-menu-${section}`

  return (
    <section className="utility-menu__section">
      <button
        className="utility-menu__section-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggle(section)}
      >
        <span>{label}</span><span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && <div className="utility-menu__section-items" id={panelId}>{children}</div>}
    </section>
  )
}

export function UtilityMenu() {
  const location = useLocation()
  const { openPanel, setChatDockExpanded } = useSocialPanel()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const isWorldRoute = location.pathname === '/' || location.pathname === '/farm' || location.pathname === '/world-preview' || location.pathname === '/town'

  useEffect(() => {
    if (!open) return

    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false)
    }

    function dismissEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [open])

  if (isWorldRoute) return null

  function openSocial(tab: 'friends' | 'messages') {
    setOpen(false)
    setChatDockExpanded(false)
    openPanel(tab)
  }

  return (
    <div className="utility-menu" ref={containerRef}>
      {open && (
        <GameMenuPanel
          id="utility-panel"
          onDismiss={() => setOpen(false)}
          onOpenChat={() => openSocial('messages')}
          onOpenFriends={() => openSocial('friends')}
        />
      )}
      <button
        className="utility-menu__toggle"
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? 'utility-panel' : undefined}
        aria-label={`${open ? 'Close' : 'Open'} CactiGrow game menu`}
      >
        Game Menu
      </button>
    </div>
  )
}
