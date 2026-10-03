import { useCallback, useMemo, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { getListingForPlant } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import type { GardenFilters } from '../../types/garden'
import { BreedingWorkflow } from '../breeding/BreedingWorkflow'
import { SellWorkflow } from '../marketplace/SellWorkflow'
import { MultiSellDialog } from './MultiSellDialog'
import { getGardenLevelDefinition } from '../property/propertyConfig'
import { ResearchWorkflow } from '../research/ResearchWorkflow'
import { filterAndSortGardenPlants, getGardenTags } from './gardenOrganizationModel'
import { PlantDetails } from './PlantDetails'
import { SpecimenQuickPreview } from './SpecimenQuickPreview'
import { useGardenSelection } from './useGardenSelection'
import { EmptyState } from '../../components/ui/EmptyState'
import { GARDEN_DISPLAY_SLOT_IDS } from '../../types/garden'
import { gardenDisplayLabels } from './gardenDisplayModel'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { createPlantVisualDescriptor } from '../plants/plantVisualModel'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { ServerGardenPage } from './ServerGardenPage'
import { GardenDisplaySection } from './GardenDisplaySection'
import { CollectionTools } from './CollectionTools'
import { CollectionKnowledge } from './CollectionKnowledge'
import { FavoriteControl } from './FavoriteControl'
import { BulkResearchDialog } from './BulkResearchDialog'
import { ResearchSelectionAction } from './ResearchSelectionAction'
import { COLLECTION_PAGE_SIZE, DEFAULT_COLLECTION_FILTERS, canUseBulkBreeding, isEligibleForBreeding, manageCollection, type CollectionSort } from './collectionManagement'
import { getLevelFromXp } from '../progression/progressionModel'

const defaultFilters: GardenFilters = { favoriteOnly: false, speciesId: '', tag: '', listing: 'all', special: 'all' }

export function GardenPage() {
  const lifecycle = usePlantLifecycle()
  if (lifecycle.state.authority === 'server') return <ServerGardenPage />
  return <LocalGardenPage />
}

function LocalGardenPage() {
  const { state, setGardenFavorite, addGardenTag, removeGardenTag, assignGardenDisplay, clearGardenDisplay, sellPlantToNpc } = useGameState()
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null)
  const [quickPreviewPlantId, setQuickPreviewPlantId] = useState<string | null>(null)
  const [breedingParentId, setBreedingParentId] = useState<string | null>(null)
  const [sellingPlantId, setSellingPlantId] = useState<string | null>(null)
  const [multiSellVisible, setMultiSellVisible] = useState(false)
  const [researchPlantId, setResearchPlantId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const openSelectionMode = useCallback(() => setSelectionMode(true), [])
  const [filters, setFilters] = useState(defaultFilters)
  const [managementFilters, setManagementFilters] = useState(DEFAULT_COLLECTION_FILTERS)
  const [managementSort, setManagementSort] = useState<CollectionSort>('newest')
  const [page, setPage] = useState(0)
  const [batchResearch, setBatchResearch] = useState(false)
  const level = getLevelFromXp(state.player.skills.genetics.xp)
  const specimenRefs = useRef(new Map<string, HTMLButtonElement>())
  const gardenLevel = state.property.buildings.garden.level
  const organizationUnlocked = gardenLevel >= 2
  const gardenDefinition = getGardenLevelDefinition(gardenLevel)
  const visiblePlants = useMemo(() => manageCollection(organizationUnlocked ? filterAndSortGardenPlants(state.ownedPlants, state.gardenOrganization, filters, 'recent') : state.ownedPlants, state.gardenOrganization, state.geneticsResearch, level, managementFilters, managementSort), [filters, organizationUnlocked, state.gardenOrganization, state.ownedPlants, state.geneticsResearch, level, managementFilters, managementSort])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visiblePlants.length / COLLECTION_PAGE_SIZE) - 1))
  const displayedPlants = visiblePlants.slice(currentPage * COLLECTION_PAGE_SIZE, (currentPage + 1) * COLLECTION_PAGE_SIZE)
  const ownedIds = useMemo(() => new Set(state.ownedPlants.map((p) => p.id)), [state.ownedPlants])
  const selection = useGardenSelection(ownedIds)
  const closeSelectionMode = useCallback(() => { setSelectionMode(false); selection.exit() }, [selection])
  const selectedPlant = state.ownedPlants.find((plant) => plant.id === selectedPlantId)
  const quickPreviewPlant = quickPreviewPlantId ? state.ownedPlants.find((plant) => plant.id === quickPreviewPlantId) : null
  const researchPlant = state.ownedPlants.find((plant) => plant.id === researchPlantId)
  const speciesOptions = [...new Set(state.ownedPlants.map((plant) => plant.speciesId))]
  const tags = getGardenTags(state.gardenOrganization)
  const closeDetails = useCallback(() => setSelectedPlantId(null), [])
  const closeQuickPreview = useCallback(() => setQuickPreviewPlantId(null), [])
  const openQuickPreview = useCallback((plantId: string) => setQuickPreviewPlantId(plantId), [])
  const openFullDetailsFromPreview = useCallback((plantId: string) => { setQuickPreviewPlantId(null); setSelectedPlantId(plantId) }, [])
  const restoreFocus = useCallback((plantId: string | null) => requestAnimationFrame(() => { if (plantId) specimenRefs.current.get(plantId)?.focus() }), [])
  const closeBreeding = useCallback(() => { restoreFocus(breedingParentId); setBreedingParentId(null) }, [breedingParentId, restoreFocus])
  const closeSelling = useCallback(() => { restoreFocus(sellingPlantId); setSellingPlantId(null) }, [restoreFocus, sellingPlantId])
  const closeResearch = useCallback(() => { restoreFocus(researchPlantId); setResearchPlantId(null) }, [researchPlantId, restoreFocus])

  const handleMultiSell = useCallback(async (plantId: string): Promise<boolean> => {
    const result = await sellPlantToNpc(plantId)
    return result !== null
  }, [sellPlantToNpc])

  const handleMultiSellDone = useCallback((soldIds: Set<string>) => { selection.remove(soldIds) }, [selection])

  return <section aria-labelledby="garden-title" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
    <header className="garden-heading"><div><h1 id="garden-title">Garden <span>Lv. {gardenLevel}</span></h1><p>{gardenDefinition.name}</p></div>{organizationUnlocked && <span className="garden-heading__status">Organized Beds active</span>}{!selectionMode && state.ownedPlants.length > 0 && <button className="cg-button" type="button" onClick={openSelectionMode} aria-pressed={selectionMode}>Select</button>}{selectionMode && <span className="garden-heading__status" aria-live="polite">{selection.selectedCount} selected</span>}</header>
    <GardenDisplaySection description="Choose specimens from your collection to display on the Farm.">{GARDEN_DISPLAY_SLOT_IDS.map((id) => {
      const specimen = state.ownedPlants.find((plant) => plant.id === state.gardenDisplayAssignments[id])
      return <div key={id} className="garden-display-summary__slot"><strong>{gardenDisplayLabels[id]}</strong><span>{specimen ? `${getSpeciesById(specimen.speciesId)?.commonName ?? 'Unknown cactus'} - ${specimen.id}` : 'Empty'}</span>{specimen && <button type="button" onClick={() => clearGardenDisplay(id)} aria-label={`Remove ${specimen.id} from ${gardenDisplayLabels[id]} display`}>Remove</button>}</div>
    })}</GardenDisplaySection>
    <CollectionTools filters={managementFilters} sort={managementSort} speciesIds={speciesOptions} count={visiblePlants.length} total={state.ownedPlants.length} onFilters={(next) => { setManagementFilters(next); setPage(0) }} onSort={(next) => { setManagementSort(next); setPage(0) }} />
    {organizationUnlocked && state.ownedPlants.length > 0 && <details className="garden-tools">
      <summary>More organization filters <span>{visiblePlants.length} of {state.ownedPlants.length}</span></summary>
      <div className="garden-tools__panel">
        <label><span>Tag</span><select value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}><option value="">All tags</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label><span>Special</span><select value={filters.special} onChange={(event) => setFilters({ ...filters, special: event.target.value as GardenFilters['special'] })}><option value="all">All specimens</option><option value="shiny">Visible Shiny</option><option value="hybrid">Known hybrids</option></select></label>
        <button type="button" onClick={() => { setFilters(defaultFilters) }}>Reset</button>
      </div>
    </details>}
    {state.ownedPlants.length === 0 ? <EmptyState title="No collected plants yet">Collect a mature plant from the Nursery to add it here.</EmptyState> : visiblePlants.length === 0 ? <EmptyState title="No matching specimens">Adjust or reset the Garden filters.</EmptyState> : <div className="garden-specimens">{displayedPlants.map((plant) => {
      const species = getSpeciesById(plant.speciesId)
      const metadata = state.gardenOrganization[plant.id]
      const selected = selection.isSelected(plant.id)
      return <article className={`garden-specimen${selected ? ' garden-specimen--selected' : ''}`} key={plant.id} data-selected={selected ? 'true' : undefined}><button className="garden-specimen__select" type="button" ref={(node) => { if (node) specimenRefs.current.set(plant.id, node); else specimenRefs.current.delete(plant.id) }} onClick={selectionMode ? () => selection.toggle(plant.id) : () => setSelectedPlantId(plant.id)} aria-haspopup={selectionMode ? undefined : "dialog"} aria-label={selectionMode ? `${selected ? 'Deselect' : 'Select'} ${species?.commonName ?? 'unknown cactus'} specimen ${plant.id}` : `View details for ${species?.commonName ?? 'unknown cactus'} specimen ${plant.id}`} aria-pressed={selectionMode ? selected : undefined} ><PlantVisual visual={createPlantVisualDescriptor(plant)} />{selected && <span className="garden-specimen__check" aria-hidden="true">&#10003;</span>}{metadata?.favorite && <span className="garden-specimen__favorite" aria-label="Favorite">&#9733;</span>}{plant.isListedForSale && <span className="garden-specimen__listed">Listed on Marketplace</span>}<strong>{species?.commonName ?? 'Unknown cactus'}</strong><em>{species?.scientificName}</em><span className="garden-specimen__id">Specimen {plant.id.slice(0, 8)}</span><CollectionKnowledge plant={plant} research={state.geneticsResearch} level={level} />{metadata?.tags.length ? <span className="garden-specimen__tags">{metadata.tags.join(' · ')}</span> : null}</button><FavoriteControl favorite={Boolean(metadata?.favorite)} listed={plant.isListedForSale} name={`specimen ${plant.id}`} onChange={(favorite) => setGardenFavorite(plant.id, favorite)} /><div className="garden-specimen__actions"><button className="garden-specimen__quick-view" type="button" onClick={(event) => { event.stopPropagation(); openQuickPreview(plant.id) }} aria-label={`Quick view ${species?.commonName ?? 'unknown cactus'} specimen ${plant.id}`}>Quick view</button><button className="garden-specimen__details" type="button" onClick={() => setSelectedPlantId(plant.id)} aria-label={`Full details for ${species?.commonName ?? 'unknown cactus'} specimen ${plant.id}`}>Details</button></div></article>
    })}</div>}
    {visiblePlants.length > COLLECTION_PAGE_SIZE && <nav className="collection-pagination" aria-label="Collection pages"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {Math.ceil(visiblePlants.length / COLLECTION_PAGE_SIZE)}</span><button type="button" disabled={(currentPage + 1) * COLLECTION_PAGE_SIZE >= visiblePlants.length} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
    {batchResearch && <BulkResearchDialog plants={state.ownedPlants.filter((plant) => selection.selectedIds.has(plant.id))} onClose={() => setBatchResearch(false)} />}
    {selectedPlant && <PlantDetails plant={selectedPlant} species={getSpeciesById(selectedPlant.speciesId)} onClose={closeDetails} onBreed={() => { setBreedingParentId(selectedPlant.id); setSelectedPlantId(null) }} onSell={() => { setSellingPlantId(selectedPlant.id); setSelectedPlantId(null) }} onResearch={() => { setResearchPlantId(selectedPlant.id); setSelectedPlantId(null) }} isListed={Boolean(getListingForPlant(state.marketplaceListings, selectedPlant.id))} organization={state.gardenOrganization[selectedPlant.id]} organizationUnlocked={organizationUnlocked} onFavoriteChange={(favorite) => setGardenFavorite(selectedPlant.id, favorite)} onAddTag={(tag) => addGardenTag(selectedPlant.id, tag)} onRemoveTag={(tag) => removeGardenTag(selectedPlant.id, tag)} displayAssignments={state.gardenDisplayAssignments} onAssignDisplay={(slotId) => assignGardenDisplay(slotId, selectedPlant.id)} onClearDisplay={clearGardenDisplay} />}
    {quickPreviewPlant && <SpecimenQuickPreview plant={quickPreviewPlant} species={getSpeciesById(quickPreviewPlant.speciesId)} organization={state.gardenOrganization[quickPreviewPlant.id] ?? { favorite: false, tags: [] }} onClose={closeQuickPreview} onFullDetails={() => openFullDetailsFromPreview(quickPreviewPlant.id)} />}
    {breedingParentId && <BreedingWorkflow parent1Id={breedingParentId} onClose={closeBreeding} />}
    {sellingPlantId && <SellWorkflow plantId={sellingPlantId} onClose={closeSelling} />}
    {researchPlant && <ResearchWorkflow plant={researchPlant} onClose={closeResearch} />}
    {multiSellVisible && <MultiSellDialog organization={state.gardenOrganization} selectedSpecimenIds={selection.selectedIds} ownedPlants={state.ownedPlants} onClose={() => setMultiSellVisible(false)} onSold={handleMultiSellDone} onSellPlant={handleMultiSell} />}
    {selectionMode && <div className="garden-selection-bar" role="toolbar" aria-label="Selection controls">
      <span className="garden-selection-bar__count" aria-live="polite">{selection.selectedCount} {selection.selectedCount === 1 ? 'specimen' : 'specimens'} selected</span>
      <div className="garden-selection-bar__actions">
        <button className="cg-button" type="button" onClick={() => selection.select(displayedPlants.map((plant) => plant.id))}>Select page ({displayedPlants.length})</button>
        <button className="cg-button" type="button" onClick={() => selection.select(visiblePlants.map((plant) => plant.id))}>Select filtered ({visiblePlants.length})</button>
        <ResearchSelectionAction plants={state.ownedPlants.filter((plant) => selection.selectedIds.has(plant.id))} research={state.geneticsResearch} level={level} property={state.property} dialogOpen={batchResearch} onOpen={() => setBatchResearch(true)} />
        <button className="cg-button" type="button" disabled={!canUseBulkBreeding(state.property) || state.ownedPlants.filter((plant) => selection.selectedIds.has(plant.id) && isEligibleForBreeding(plant)).length < 2} onClick={() => { const first = state.ownedPlants.find((plant) => selection.selectedIds.has(plant.id) && isEligibleForBreeding(plant)); if (first) setBreedingParentId(first.id) }}>Choose parents</button>
        {selection.selectedCount > 0 && <button className="cg-button cg-button--sell" type="button" onClick={() => setMultiSellVisible(true)} disabled={selection.selectedCount === 0}>Sell to NPC</button>}
        {selection.selectedCount > 0 && <button className="cg-button cg-button--marketplace" type="button" disabled aria-disabled="true">List on Marketplace</button>}
        {selection.selectedCount > 0 && <button className="cg-button cg-button--ghost" type="button" onClick={selection.clear} disabled={selection.selectedCount === 0}>Clear</button>}
        <button className="cg-button cg-button--ghost" type="button" onClick={closeSelectionMode}>Done</button>
      </div>
    </div>}
  </section>
}
