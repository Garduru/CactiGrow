import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ResolvedWorldBuilding } from './locations'

interface BuildingDetailsProps { building: ResolvedWorldBuilding; onClose: () => void }

export function BuildingDetails({ building, onClose }: BuildingDetailsProps) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previousFocus?.focus() }
  }, [building.id, onClose])

  return (
    <div className="building-details__backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={panelRef} className="building-details" role="dialog" aria-modal="true" aria-labelledby="building-details-title" tabIndex={-1}>
        <span className="eyebrow">Building Details</span>
        <h2 id="building-details-title">{building.displayName}</h2>
        {building.currentTier && <strong className="building-details__tier">Tier {building.currentTier.id} · {building.currentTier.name}</strong>}
        <p>{building.description}</p>
        <div className="building-details__section"><h3>Current purpose</h3><p>{building.purpose}</p></div>
        {building.capabilities.length > 0 && <div className="building-details__section"><h3>Current capabilities</h3><ul>{building.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></div>}
        <div className="building-details__section"><h3>Facility bonuses</h3><p>{building.bonuses.length ? building.bonuses.map((bonus) => bonus.displayName).join(', ') : 'None yet'}</p></div>
        <div className="building-details__actions"><button type="button" onClick={onClose}>Close</button><button type="button" className="building-details__enter" onClick={() => navigate(building.route)}>Enter {building.displayName}</button></div>
      </section>
    </div>
  )
}
