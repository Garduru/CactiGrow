import { useStartingExperience } from '../starting/StartingContext'
import { tutorialPlantRole } from '../starting/tutorialGuidance'
import { useEffect, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useGameState } from '../../game/useGameState'
import { canBreed } from './breedingModel'
import { CollectionKnowledge } from '../garden/CollectionKnowledge'
import { getLevelFromXp } from '../progression/progressionModel'
import type { BredSeedV2 } from '../../../shared/api/plantLifecycleV2'

export function ServerBreedingWorkflow({ parent1Id, candidateIds, onClose }: { parent1Id: string; candidateIds?: string[]; onClose: () => void }) {
  const { state, breed } = usePlantLifecycle()
  const game = useGameState()
  const tutorial = useStartingExperience()
  const guided = tutorial.active && tutorial.state?.farmStage === 'breeding' && !tutorial.state.farmTutorialComplete
  const [chosenFirstId, setFirstId] = useState(parent1Id)
  const firstId = guided ? tutorial.state!.tutorialParentIds[0] : chosenFirstId
  const [search, setSearch] = useState('')
  const plants = new Map(game.state.ownedPlants.map((plant) => [plant.id, plant]))
  const level = getLevelFromXp(game.state.player.skills.genetics.xp)
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
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select')]
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
  const parent1 = state.projection.ownedSpecimens.find((plant) => plant.specimenId === firstId)
  if (!parent1) return null
  const eligible = state.projection.ownedSpecimens.filter((plant) =>
    plant.lifecycleStatus === 'owned' && !!plant.collectedAt
    && (guided ? plant.specimenId === tutorial.state!.tutorialParentIds[1] : !tutorialPlantRole(tutorial.state, firstId) && !tutorialPlantRole(tutorial.state, plant.specimenId) && (!candidateIds || candidateIds.includes(plant.specimenId)))
    && canBreed(plants.get(firstId), plants.get(plant.specimenId)))
  const visibleCandidates = eligible.filter((plant) => `${getSpeciesById(plant.speciesId)?.commonName} ${getSpeciesById(plant.speciesId)?.scientificName} ${plant.specimenId}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const parent2 = eligible.find((plant) => plant.specimenId === parent2Id)

  async function confirm() {
    if (!parent2 || submitting.current) return
    submitting.current = true
    setIsSubmitting(true)
    const seed = await breed(firstId, parent2.specimenId)
    if (seed) setResult(seed)
    else { setError('Breeding could not be completed. Refresh and check both parents.'); submitting.current = false; setIsSubmitting(false) }
  }

  return <div className="breeding-overlay">
    <button className="plant-details__backdrop" type="button" onClick={onClose} aria-label="Close breeding workflow" />
    <section className="breeding-workflow" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="breeding-title">
      <header className="plant-details__header"><div><span className="eyebrow">Garden workflow</span><h2 id="breeding-title">Breed a new seed</h2></div><button className="plant-details__close" ref={closeRef} type="button" onClick={onClose} aria-label="Close breeding workflow">×</button></header>
      {result ? <div className="breeding-result"><span className="nursery-stage nursery-stage--mature">Seed created</span><h3>{getSpeciesById(result.speciesId)?.commonName ?? 'Offspring'} seed</h3><p>Unique seed {result.seedId} is available in Inventory and the Nursery.</p><p>Both parent specimens remain in your Garden.</p><button className="nursery-button" type="button" onClick={onClose}>Finish</button></div> : <>
        <section className="breeding-section"><h3>Parent 1</h3>{candidateIds && !guided && <label>Shortlisted first parent<select value={firstId} disabled={isSubmitting} onChange={(e) => { setFirstId(e.target.value); setParent2Id(null) }}>{candidateIds.filter((id) => plants.has(id)).map((id) => <option value={id} key={id}>{getSpeciesById(plants.get(id)!.speciesId)?.commonName} · {id.slice(0, 8)}</option>)}</select></label>}<p>{tutorialPlantRole(tutorial.state, firstId) ?? getSpeciesById(parent1.speciesId)?.commonName ?? parent1.speciesId}</p>{guided && <small>The San Pedro you grew in Path 1 and observed. Your mature Practice partner is ready below; breeding does not require research on both parents.</small>}</section>
        <section className="breeding-section"><h3>Choose Parent 2</h3><p>Only unlisted mature specimens from the same genus are shown. Favorites can breed safely.</p><label>Search parents<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>{eligible.length ? <div className="breeding-candidates">{visibleCandidates.map((plant) => <button type="button" key={plant.specimenId} data-tutorial-target={`partner:${plant.specimenId}`} className="breeding-candidate" disabled={isSubmitting} aria-pressed={parent2Id === plant.specimenId} onClick={() => setParent2Id(plant.specimenId)}><strong>{tutorialPlantRole(tutorial.state, plant.specimenId) ?? getSpeciesById(plant.speciesId)?.commonName ?? plant.speciesId}</strong><small>{guided ? 'Mature, compatible San Pedro practice plant' : plant.specimenId.slice(0, 8)}</small>{game.state.gardenOrganization[plant.specimenId]?.favorite && <span>★ Favorite</span>}{plants.get(plant.specimenId) && <CollectionKnowledge plant={plants.get(plant.specimenId)!} research={game.state.geneticsResearch} level={level} />}{parent2Id === plant.specimenId && <span className="breeding-candidate__selected">&#10003; Selected &middot; Parent 2</span>}</button>)}</div> : <p className="breeding-empty">No other collected specimen from the same genus is available.</p>}</section>
        {parent2 && <section className="breeding-section"><h3>Parent review</h3><p>Parent 1: {tutorialPlantRole(tutorial.state, firstId) ?? getSpeciesById(parent1.speciesId)?.commonName}</p><p>Parent 2: {tutorialPlantRole(tutorial.state, parent2.specimenId) ?? getSpeciesById(parent2.speciesId)?.commonName}</p><p>Both parents remain owned. Offspring genetics resolve once on the server when you breed.</p><button data-tutorial-target="confirm-breeding" className="nursery-button" type="button" onClick={() => void confirm()} disabled={isSubmitting}>Confirm breeding</button>{error && <p className="form-error" role="alert">{error}</p>}</section>}
      </>}
    </section>
  </div>
}
