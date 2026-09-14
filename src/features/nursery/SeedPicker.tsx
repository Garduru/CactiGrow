import { useEffect, useRef } from 'react'
import { getSpeciesById } from '../../data/species'
import type { InventoryItem } from '../../types/inventory'
import type { BredSeed } from '../../types/bredSeed'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'

interface SeedPickerProps {
  seeds: InventoryItem[]
  bredSeeds: BredSeed[]
  onSelect: (speciesId: string) => void
  onSelectBredSeed: (seedId: string) => void
  onClose: () => void
}

export function SeedPicker({ seeds, bredSeeds, onSelect, onSelectBredSeed, onClose }: SeedPickerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="seed-picker" role="dialog" aria-modal="true" aria-labelledby="seed-picker-title">
      <button className="seed-picker__backdrop" type="button" onClick={onClose} aria-label="Close seed selection" />
      <section className="seed-picker__panel" ref={panelRef}>
        <div className="seed-picker__heading">
          <div><span className="eyebrow">Mock inventory</span><h2 id="seed-picker-title">Choose a seed</h2></div>
          <button className="seed-picker__close" ref={closeRef} type="button" onClick={onClose} aria-label="Close seed selection">×</button>
        </div>
        <div className="seed-picker__options">
          {!seeds.length && !bredSeeds.length && <EmptyState compact title="No seeds available">Return after acquiring seeds to plant this position.</EmptyState>}
          {seeds.map((seed) => {
            const seedSpecies = getSpeciesById(seed.itemKey)
            return (
              <button
                className="seed-option"
                key={seed.id}
                type="button"
                disabled={seed.quantity === 0}
                onClick={() => onSelect(seed.itemKey)}
              >
                <span className="seed-option__icon" aria-hidden="true">◉</span>
                <span><strong>{seedSpecies?.commonName ?? 'Unknown seed'}</strong><small>{seedSpecies?.scientificName}</small></span>
                <Badge tone={seed.quantity ? 'neutral' : 'locked'}>× {seed.quantity}</Badge>
              </button>
            )
          })}
          {bredSeeds.map((seed) => {
            const seedSpecies = getSpeciesById(seed.speciesId)
            return <button className="seed-option seed-option--bred" key={seed.id} type="button" onClick={() => onSelectBredSeed(seed.id)}><span className="seed-option__icon" aria-hidden="true">◆</span><span><strong>{seedSpecies?.commonName ?? 'Bred offspring'} seed</strong><small>Unique offspring · Parents {seed.parentPlantIds.join(' + ')}</small></span><span className="seed-option__statuses"><Badge tone="accent">Bred</Badge>{seed.isHybrid && <Badge tone="accent">Hybrid</Badge>}{seed.quantitativeTreatments?.length ? <Badge tone="warning">Treated</Badge> : null}</span></button>
          })}
        </div>
        <p className="seed-picker__note">Prototype growth is accelerated to about two minutes.</p>
      </section>
    </div>
  )
}
