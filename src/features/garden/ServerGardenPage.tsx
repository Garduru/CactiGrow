import { useCallback, useState } from 'react'
import { GARDEN_DISPLAY_SLOT_IDS } from '../../types/garden'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { getSpeciesById } from '../../data/species'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { EmptyState } from '../../components/ui/EmptyState'
import { createPlantVisualDescriptor } from '../plants/plantVisualModel'
import { gardenDisplayLabels } from './gardenDisplayModel'
import { PlantDetails } from './PlantDetails'
import { GardenDisplaySection } from './GardenDisplaySection'
import { ServerBreedingWorkflow } from '../breeding/ServerBreedingWorkflow'
import { useGardenAuthority } from '../../app/useGardenAuthority'
import { useGameState } from '../../game/useGameState'
import { SellWorkflow } from '../marketplace/SellWorkflow'
import { ResearchWorkflow } from '../research/ResearchWorkflow'

export function ServerGardenPage() {
  const { state } = usePlantLifecycle()
  const garden = useGardenAuthority()
  const game = useGameState()
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null)
  const [breedingParentId, setBreedingParentId] = useState<string | null>(null)
  const [sellingPlantId, setSellingPlantId] = useState<string | null>(null)
  const [researchPlantId, setResearchPlantId] = useState<string | null>(null)
  const closeDetails = useCallback(() => setSelectedSpecimenId(null), [])

  if (state.authority !== 'server') return null
  if (state.status !== 'ready') return <section aria-labelledby="garden-title">
    <header className="garden-heading"><h1 id="garden-title">Garden</h1></header>
    <p role={state.status === 'error' ? 'alert' : 'status'}>{state.status === 'error' ? 'Unable to load your collected specimens.' : 'Loading your collected specimens…'}</p>
  </section>

  const specimens = [...state.projection.ownedSpecimens].sort((a, b) => Date.parse(b.collectedAt ?? '') - Date.parse(a.collectedAt ?? ''))
  const selected = specimens.find((specimen) => specimen.specimenId === selectedSpecimenId)
  const selectedPlant = game.state.ownedPlants.find((plant) => plant.id === selectedSpecimenId)
  return <section aria-labelledby="garden-title">
    <header className="garden-heading"><div><h1 id="garden-title">Garden</h1><p>Your collected specimens</p></div></header>
    <GardenDisplaySection description="Your collection is not limited by the six display beds. Choose which owned specimens appear outside.">
      {GARDEN_DISPLAY_SLOT_IDS.map((id) => {
        const specimenId = garden.projection?.displayAssignments[id] ?? null
        return <div key={id} className="garden-display-summary__slot"><strong>{gardenDisplayLabels[id]}</strong><select aria-label={`${gardenDisplayLabels[id]} specimen`} value={specimenId ?? ''} disabled={garden.loading} onChange={(event) => { const value = event.target.value; void garden.mutate(value ? { type: 'assign-display', slotId: id, specimenId: value } : { type: 'clear-display', slotId: id }) }}><option value="">Empty</option>{specimens.map((specimen) => <option key={specimen.specimenId} value={specimen.specimenId}>{getSpeciesById(specimen.speciesId)?.commonName ?? 'Unknown'} — {specimen.specimenId.slice(0, 8)}</option>)}</select></div>
      })}
    </GardenDisplaySection>
    {specimens.length === 0 ? <EmptyState title="No collected plants yet">Collect a mature plant from the Nursery to add it here.</EmptyState> :
      <div className="garden-specimens">{specimens.map((specimen) => {
        const species = getSpeciesById(specimen.speciesId)
        return <article className="garden-specimen" key={specimen.specimenId}>
          <button className="garden-specimen__select" type="button" onClick={() => setSelectedSpecimenId(specimen.specimenId)} aria-haspopup="dialog" aria-label={`View details for ${species?.commonName ?? 'unknown cactus'} specimen ${specimen.specimenId}`}>
            <span className="nursery-stage nursery-stage--mature">mature</span>
            <PlantVisual visual={createPlantVisualDescriptor(specimen)} />
            <strong>{species?.commonName ?? 'Unknown cactus'}</strong><em>{species?.scientificName}</em>
            <span className="garden-specimen__id">Specimen {specimen.specimenId}</span>
            <span className="garden-specimen__prompt">View details →</span>
          </button>
        </article>
      })}</div>}
    {selected && selectedPlant && <PlantDetails plant={selectedPlant} species={getSpeciesById(selected.speciesId)} onClose={closeDetails} onBreed={() => { setBreedingParentId(selected.specimenId); setSelectedSpecimenId(null) }} onSell={() => { setSellingPlantId(selected.specimenId); setSelectedSpecimenId(null) }} onResearch={() => { setResearchPlantId(selected.specimenId); setSelectedSpecimenId(null) }} isListed={selectedPlant.isListedForSale} organization={game.state.gardenOrganization[selectedPlant.id]} organizationUnlocked={game.state.property.buildings.garden.level >= 2} onFavoriteChange={(favorite) => { void game.setGardenFavorite(selectedPlant.id, favorite) }} onAddTag={(tag) => game.addGardenTag(selectedPlant.id, tag)} onRemoveTag={(tag) => { void game.removeGardenTag(selectedPlant.id, tag) }} displayAssignments={game.state.gardenDisplayAssignments} onAssignDisplay={(slotId) => { void game.assignGardenDisplay(slotId, selectedPlant.id) }} onClearDisplay={(slotId) => { void game.clearGardenDisplay(slotId) }} />}
    {breedingParentId && <ServerBreedingWorkflow parent1Id={breedingParentId} onClose={() => setBreedingParentId(null)} />}
    {sellingPlantId && <SellWorkflow plantId={sellingPlantId} onClose={() => setSellingPlantId(null)} />}
    {researchPlantId && game.state.ownedPlants.find((plant) => plant.id === researchPlantId) && <ResearchWorkflow plant={game.state.ownedPlants.find((plant) => plant.id === researchPlantId)!} onClose={() => setResearchPlantId(null)} />}
  </section>
}
