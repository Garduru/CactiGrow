import { useCallback, useMemo, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { getListingForPlant } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import type { GardenFilters, GardenSort } from '../../types/garden'
import { BreedingWorkflow } from '../breeding/BreedingWorkflow'
import { SellWorkflow } from '../marketplace/SellWorkflow'
import { getGardenLevelDefinition } from '../property/propertyConfig'
import { ResearchWorkflow } from '../research/ResearchWorkflow'
import { filterAndSortGardenPlants, getGardenTags } from './gardenOrganizationModel'
import { PlantDetails } from './PlantDetails'
import { EmptyState } from '../../components/ui/EmptyState'

const defaultFilters: GardenFilters = { favoriteOnly: false, speciesId: '', tag: '', listing: 'all', special: 'all' }

export function GardenPage() {
  const { state, setGardenFavorite, addGardenTag, removeGardenTag } = useGameState()
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null)
  const [breedingParentId, setBreedingParentId] = useState<string | null>(null)
  const [sellingPlantId, setSellingPlantId] = useState<string | null>(null)
  const [researchPlantId, setResearchPlantId] = useState<string | null>(null)
  const [filters, setFilters] = useState(defaultFilters)
  const [sort, setSort] = useState<GardenSort>('recent')
  const specimenRefs = useRef(new Map<string, HTMLButtonElement>())
  const gardenLevel = state.property.buildings.garden.level
  const organizationUnlocked = gardenLevel >= 2
  const gardenDefinition = getGardenLevelDefinition(gardenLevel)
  const visiblePlants = useMemo(() => organizationUnlocked ? filterAndSortGardenPlants(state.ownedPlants, state.gardenOrganization, filters, sort) : state.ownedPlants, [filters, organizationUnlocked, sort, state.gardenOrganization, state.ownedPlants])
  const selectedPlant = state.ownedPlants.find((plant) => plant.id === selectedPlantId)
  const researchPlant = state.ownedPlants.find((plant) => plant.id === researchPlantId)
  const speciesOptions = [...new Set(state.ownedPlants.map((plant) => plant.speciesId))]
  const tags = getGardenTags(state.gardenOrganization)
  const closeDetails = useCallback(() => setSelectedPlantId(null), [])
  const restoreFocus = useCallback((plantId: string | null) => requestAnimationFrame(() => { if (plantId) specimenRefs.current.get(plantId)?.focus() }), [])
  const closeBreeding = useCallback(() => { restoreFocus(breedingParentId); setBreedingParentId(null) }, [breedingParentId, restoreFocus])
  const closeSelling = useCallback(() => { restoreFocus(sellingPlantId); setSellingPlantId(null) }, [restoreFocus, sellingPlantId])
  const closeResearch = useCallback(() => { restoreFocus(researchPlantId); setResearchPlantId(null) }, [researchPlantId, restoreFocus])

  return <section aria-labelledby="garden-title">
    <header className="garden-heading"><div><h1 id="garden-title">Garden <span>Lv. {gardenLevel}</span></h1><p>{gardenDefinition.name}</p></div>{organizationUnlocked && <span className="garden-heading__status">Organized Beds active</span>}</header>
    {organizationUnlocked && state.ownedPlants.length > 0 && <details className="garden-tools">
      <summary>Filter and sort <span>{visiblePlants.length} of {state.ownedPlants.length}</span></summary>
      <div className="garden-tools__panel">
        <label><span>Species</span><select value={filters.speciesId} onChange={(event) => setFilters({ ...filters, speciesId: event.target.value })}><option value="">All species</option>{speciesOptions.map((id) => <option key={id} value={id}>{getSpeciesById(id)?.commonName ?? id}</option>)}</select></label>
        <label><span>Tag</span><select value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}><option value="">All tags</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label><span>Listing</span><select value={filters.listing} onChange={(event) => setFilters({ ...filters, listing: event.target.value as GardenFilters['listing'] })}><option value="all">Listed and unlisted</option><option value="listed">Listed</option><option value="unlisted">Unlisted</option></select></label>
        <label><span>Special</span><select value={filters.special} onChange={(event) => setFilters({ ...filters, special: event.target.value as GardenFilters['special'] })}><option value="all">All specimens</option><option value="shiny">Visible Shiny</option><option value="hybrid">Known hybrids</option></select></label>
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as GardenSort)}><option value="recent">Recently collected</option><option value="species">Species</option><option value="favorite">Favorites first</option><option value="clone-line">Clone line</option></select></label>
        <label className="garden-tools__favorite"><input type="checkbox" checked={filters.favoriteOnly} onChange={(event) => setFilters({ ...filters, favoriteOnly: event.target.checked })} /> Favorites only</label>
        <button type="button" onClick={() => { setFilters(defaultFilters); setSort('recent') }}>Reset</button>
      </div>
    </details>}
    {state.ownedPlants.length === 0 ? <EmptyState title="No collected plants yet">Collect a mature plant from the Nursery to add it here.</EmptyState> : visiblePlants.length === 0 ? <EmptyState title="No matching specimens">Adjust or reset the Garden filters.</EmptyState> : <div className="garden-specimens">{visiblePlants.map((plant) => {
      const species = getSpeciesById(plant.speciesId)
      const metadata = state.gardenOrganization[plant.id]
      return <article className="garden-specimen" key={plant.id}><button className="garden-specimen__select" type="button" ref={(node) => { if (node) specimenRefs.current.set(plant.id, node); else specimenRefs.current.delete(plant.id) }} onClick={() => setSelectedPlantId(plant.id)} aria-haspopup="dialog" aria-label={`View details for ${species?.commonName ?? 'unknown cactus'} specimen ${plant.id}`}><span className="nursery-stage nursery-stage--mature">{plant.stage}</span>{metadata?.favorite && <span className="garden-specimen__favorite" aria-label="Favorite">★</span>}{plant.isListedForSale && <span className="garden-specimen__listed">Listed on Marketplace</span>}<strong>{species?.commonName ?? 'Unknown cactus'}</strong><em>{species?.scientificName}</em><span className="garden-specimen__id">Specimen {plant.id}</span>{metadata?.tags.length ? <span className="garden-specimen__tags">{metadata.tags.join(' · ')}</span> : null}<span className="garden-specimen__prompt">View details →</span></button></article>
    })}</div>}
    {selectedPlant && <PlantDetails plant={selectedPlant} species={getSpeciesById(selectedPlant.speciesId)} onClose={closeDetails} onBreed={() => { setBreedingParentId(selectedPlant.id); setSelectedPlantId(null) }} onSell={() => { setSellingPlantId(selectedPlant.id); setSelectedPlantId(null) }} onResearch={() => { setResearchPlantId(selectedPlant.id); setSelectedPlantId(null) }} isListed={Boolean(getListingForPlant(state.marketplaceListings, selectedPlant.id))} organization={state.gardenOrganization[selectedPlant.id]} organizationUnlocked={organizationUnlocked} onFavoriteChange={(favorite) => setGardenFavorite(selectedPlant.id, favorite)} onAddTag={(tag) => addGardenTag(selectedPlant.id, tag)} onRemoveTag={(tag) => removeGardenTag(selectedPlant.id, tag)} />}
    {breedingParentId && <BreedingWorkflow parent1Id={breedingParentId} onClose={closeBreeding} />}
    {sellingPlantId && <SellWorkflow plantId={sellingPlantId} onClose={closeSelling} />}
    {researchPlant && <ResearchWorkflow plant={researchPlant} onClose={closeResearch} />}
  </section>
}
