import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

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
