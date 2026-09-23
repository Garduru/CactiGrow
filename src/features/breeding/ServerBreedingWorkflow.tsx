import { useEffect, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import type { BredSeedV2 } from '../../../shared/api/plantLifecycleV2'

export function ServerBreedingWorkflow({ parent1Id, onClose }: { parent1Id: string; onClose: () => void }) {
  const { state, breed } = usePlantLifecycle()
  const [parent2Id, setParent2Id] = useState<string | null>(null)
  const [result, setResult] = useState<BredSeedV2 | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const submitting = useRef(false)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [onClose])

  if (state.authority !== 'server' || state.status !== 'ready') return null
  const parent1 = state.projection.ownedSpecimens.find((plant) => plant.specimenId === parent1Id)
  if (!parent1) return null
  const genus = getSpeciesById(parent1.speciesId)?.genus
  const eligible = state.projection.ownedSpecimens.filter((plant) => plant.specimenId !== parent1Id && genus && getSpeciesById(plant.speciesId)?.genus === genus)
  const parent2 = eligible.find((plant) => plant.specimenId === parent2Id)

  async function confirm() {
    if (!parent2 || submitting.current) return
    submitting.current = true
    setIsSubmitting(true)
    const seed = await breed(parent1Id, parent2.specimenId)
    if (seed) setResult(seed)
    else { setError('Breeding could not be completed. Refresh and check both parents.'); submitting.current = false; setIsSubmitting(false) }
  }

  return <div className="breeding-overlay">
    <button className="plant-details__backdrop" type="button" onClick={onClose} aria-label="Close breeding workflow" />
    <section className="breeding-workflow" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="breeding-title">
      <header className="plant-details__header"><div><span className="eyebrow">Garden workflow</span><h2 id="breeding-title">Breed a new seed</h2></div><button className="plant-details__close" ref={closeRef} type="button" onClick={onClose} aria-label="Close breeding workflow">×</button></header>
      {result ? <div className="breeding-result"><span className="nursery-stage nursery-stage--mature">Seed created</span><h3>{getSpeciesById(result.speciesId)?.commonName ?? 'Offspring'} seed</h3><p>Unique seed {result.seedId} is available in Inventory and the Nursery.</p><p>Both parent specimens remain in your Garden.</p><button className="nursery-button" type="button" onClick={onClose}>Finish</button></div> : <>
        <section className="breeding-section"><h3>Parent 1</h3><p>{getSpeciesById(parent1.speciesId)?.commonName ?? parent1.speciesId} · {parent1.specimenId}</p></section>
        <section className="breeding-section"><h3>Choose Parent 2</h3><p>Only other collected specimens from the same genus are shown.</p>{eligible.length ? <div className="breeding-candidates">{eligible.map((plant) => <button type="button" key={plant.specimenId} className="breeding-candidate" disabled={isSubmitting} aria-pressed={parent2Id === plant.specimenId} onClick={() => setParent2Id(plant.specimenId)}><strong>{getSpeciesById(plant.speciesId)?.commonName ?? plant.speciesId}</strong><small>{plant.specimenId}</small>{parent2Id === plant.specimenId && <span className="breeding-candidate__selected">&#10003; Selected &middot; Parent 2</span>}</button>)}</div> : <p className="breeding-empty">No other collected specimen from the same genus is available.</p>}</section>
        {parent2 && <section className="breeding-section"><h3>Parent review</h3><p>Parent 1: {getSpeciesById(parent1.speciesId)?.commonName} &middot; {parent1.specimenId}</p><p>Parent 2: {getSpeciesById(parent2.speciesId)?.commonName} &middot; {parent2.specimenId}</p><p>Both parents remain owned. Offspring genetics resolve once on the server when you breed.</p><button className="nursery-button" type="button" onClick={() => void confirm()} disabled={isSubmitting}>Confirm breeding</button>{error && <p className="form-error" role="alert">{error}</p>}</section>}
      </>}
    </section>
  </div>
}
