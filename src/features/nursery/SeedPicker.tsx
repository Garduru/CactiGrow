import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { getSpeciesById } from '../../data/species'
import type { InventoryItem } from '../../types/inventory'
import type { BredSeed } from '../../types/bredSeed'
import type { BredSeedV2 } from '../../../shared/api/plantLifecycleV2'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'

interface SeedPickerProps {
  seeds: InventoryItem[]
  bredSeeds: (BredSeed | BredSeedV2)[]
  onSelect: (speciesId: string) => void | Promise<void>
  onSelectBredSeed: (seedId: string) => void | Promise<void>
  onClose: () => void
}

export function SeedPicker({ seeds, bredSeeds, onSelect, onSelectBredSeed, onClose }: SeedPickerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const close = useEffectEvent(() => { if (!submitting.current) onClose() })

  async function submit(id: string, action: () => void | Promise<void>) {
    if (submitting.current) return
    submitting.current = true
    setPending(id)
    setError('')
    panelRef.current?.scrollTo({ top: 0 })
    try { await action() }
    catch (error) {
      setError(error instanceof CactiGrowApiError ? error.message : 'Planting could not be completed. Please try again.')
    } finally { submitting.current = false; setPending(null) }
  }

  useEffect(() => {
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
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
  }, [])

  return (
    <div className="seed-picker" role="dialog" aria-modal="true" aria-labelledby="seed-picker-title">
      <button className="seed-picker__backdrop" type="button" onClick={onClose} disabled={pending !== null} aria-label="Close seed selection" />
      <section className="seed-picker__panel" ref={panelRef} aria-busy={pending !== null}>
        <div className="seed-picker__heading">
          <div><span className="eyebrow">Seed inventory</span><h2 id="seed-picker-title">Choose a seed to plant</h2></div>
          <button className="seed-picker__close" ref={closeRef} type="button" onClick={onClose} disabled={pending !== null} aria-label="Close seed selection">×</button>
        </div>
        <p className="seed-picker__note" role="status">{pending ? 'Planting seed... Please wait.' : 'Tap a seed to plant it immediately in this Nursery position.'}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="seed-picker__options">
          {!seeds.length && !bredSeeds.length && <EmptyState compact title="No seeds available">Return after acquiring seeds to plant this position.</EmptyState>}
          {seeds.map((seed) => {
            const seedSpecies = getSpeciesById(seed.itemKey)
            return (
              <button
                className="seed-option"
                key={seed.id}
                type="button"
                disabled={seed.quantity === 0 || pending !== null}
                onClick={() => void submit(seed.itemKey, () => onSelect(seed.itemKey))}
              >
                <span className="seed-option__icon" aria-hidden="true">◉</span>
                <span><strong>{seedSpecies?.commonName ?? 'Unknown seed'}</strong><small>{seedSpecies?.scientificName}</small></span>
                <Badge tone={seed.quantity ? 'neutral' : 'locked'}>× {seed.quantity}</Badge>
              </button>
            )
          })}
          {bredSeeds.map((seed) => {
            const seedSpecies = getSpeciesById(seed.speciesId)
            const seedId = 'seedId' in seed ? seed.seedId : seed.id
            const treated = 'quantitativeTreatments' in seed && Boolean(seed.quantitativeTreatments?.length)
            return <button className="seed-option seed-option--bred" key={seedId} type="button" disabled={pending !== null} onClick={() => void submit(seedId, () => onSelectBredSeed(seedId))}><span className="seed-option__icon" aria-hidden="true">◆</span><span><strong>{seedSpecies?.commonName ?? 'Bred offspring'} seed</strong><small>Unique offspring · Parents {seed.parentPlantIds.join(' + ')}</small></span><span className="seed-option__statuses"><Badge tone="accent">Bred</Badge>{seed.isHybrid && <Badge tone="accent">Hybrid</Badge>}{treated ? <Badge tone="warning">Treated</Badge> : null}</span></button>
          })}
        </div>
      </section>
    </div>
  )
}
