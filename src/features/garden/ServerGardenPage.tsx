import { useCallback, useMemo, useState } from 'react'
import { GARDEN_DISPLAY_SLOT_IDS } from '../../types/garden'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useStartingExperience } from '../starting/StartingContext'
import { getSpeciesById } from '../../data/species'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { EmptyState } from '../../components/ui/EmptyState'
import { createPlantVisualDescriptor } from '../plants/plantVisualModel'
import { gardenDisplayLabels } from './gardenDisplayModel'
import { PlantDetails } from './PlantDetails'
import { SpecimenQuickPreview } from './SpecimenQuickPreview'
import { GardenDisplaySection } from './GardenDisplaySection'
import { useGardenSelection } from './useGardenSelection'
import { ServerBreedingWorkflow } from '../breeding/ServerBreedingWorkflow'
import { useGardenAuthority } from '../../app/useGardenAuthority'
import { useGameState } from '../../game/useGameState'
import { SellWorkflow } from '../marketplace/SellWorkflow'
import { MultiSellDialog } from './MultiSellDialog'
import { ResearchWorkflow } from '../research/ResearchWorkflow'
import { CollectionTools } from './CollectionTools'
import { CollectionKnowledge } from './CollectionKnowledge'
import { FavoriteControl } from './FavoriteControl'
import { BulkResearchDialog } from './BulkResearchDialog'
import { ResearchSelectionAction } from './ResearchSelectionAction'
import { COLLECTION_PAGE_SIZE, DEFAULT_COLLECTION_FILTERS, canUseBulkResearch, canUseBulkBreeding, isEligibleForBreeding, manageCollection, type CollectionSort } from './collectionManagement'
import { getLevelFromXp } from '../progression/progressionModel'

export function ServerGardenPage() {
  const { state } = usePlantLifecycle()
  const tutorial = useStartingExperience()
  const garden = useGardenAuthority()
  const game = useGameState()
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null)
  const [quickPreviewSpecimenId, setQuickPreviewSpecimenId] = useState<string | null>(null)
  const [breedingParentId, setBreedingParentId] = useState<string | null>(null)
  const [sellingPlantId, setSellingPlantId] = useState<string | null>(null)
  const [multiSellVisible, setMultiSellVisible] = useState(false)
  const [researchPlantId, setResearchPlantId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_COLLECTION_FILTERS)
  const [sort, setSort] = useState<CollectionSort>('newest')
  const [page, setPage] = useState(0)
  const [batchResearch, setBatchResearch] = useState(false)
  const [parentCandidates, setParentCandidates] = useState<string[] | undefined>()
  const level = getLevelFromXp(game.state.player.skills.genetics.xp)
  const visiblePlants = useMemo(() => manageCollection(game.state.ownedPlants, game.state.gardenOrganization, game.state.geneticsResearch, level, filters, sort), [game.state.ownedPlants, game.state.gardenOrganization, game.state.geneticsResearch, level, filters, sort])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visiblePlants.length / COLLECTION_PAGE_SIZE) - 1))
  const displayedPlants = visiblePlants.slice(currentPage * COLLECTION_PAGE_SIZE, (currentPage + 1) * COLLECTION_PAGE_SIZE)
  const plantsById = new Map(game.state.ownedPlants.map((plant) => [plant.id, plant]))

  const loadingSpecimens = state.authority === 'server' && state.status === 'ready'
    ? [...state.projection.ownedSpecimens].sort((a, b) => Date.parse(b.collectedAt ?? '') - Date.parse(a.collectedAt ?? ''))
    : []
  const visibleSpecimenIds = new Set(loadingSpecimens.map((s) => s.specimenId))
  const selection = useGardenSelection(visibleSpecimenIds)
  const shortlist = game.state.ownedPlants.filter((plant) => selection.selectedIds.has(plant.id) && isEligibleForBreeding(plant))
  const openSelectionMode = useCallback(() => setSelectionMode(true), [])
  const closeSelectionMode = useCallback(() => { setSelectionMode(false); selection.exit() }, [selection])
  const closeDetails = useCallback(() => setSelectedSpecimenId(null), [])
  const closeQuickPreview = useCallback(() => setQuickPreviewSpecimenId(null), [])
  const openQuickPreview = useCallback((specimenId: string) => setQuickPreviewSpecimenId(specimenId), [])
  const openFullDetailsFromPreview = useCallback((specimenId: string) => { setQuickPreviewSpecimenId(null); setSelectedSpecimenId(specimenId) }, [])

  const handleMultiSell = useCallback(async (plantId: string): Promise<boolean> => {
    const result = await game.sellPlantToNpc(plantId)
    return result !== null
  }, [game])

  const handleMultiSellDone = useCallback((soldIds: Set<string>) => { selection.remove(soldIds) }, [selection])

  const multiSellPlants = useMemo(() => {
    if (state.authority !== 'server') return []
    return game.state.ownedPlants.filter((plant) => selection.selectedIds.has(plant.id))
  }, [game.state.ownedPlants, selection.selectedIds, state])

  if (state.authority !== 'server') return null
  if (state.status !== 'ready') return <section aria-labelledby="garden-title" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
    <header className="garden-heading"><h1 id="garden-title">Garden</h1></header>
    <p role={state.status === 'error' ? 'alert' : 'status'}>{state.status === 'error' ? 'Unable to load your collected specimens.' : 'Loading your collected specimens…'}</p>
  </section>

  const specimens = loadingSpecimens
  const specimensById = new Map(specimens.map((specimen) => [specimen.specimenId, specimen]))
  const selected = specimens.find((specimen) => specimen.specimenId === selectedSpecimenId)
  const quickPreviewSpecimen = quickPreviewSpecimenId ? specimens.find((specimen) => specimen.specimenId === quickPreviewSpecimenId) : null
  const quickPreviewPlant = quickPreviewSpecimen ? game.state.ownedPlants.find((plant) => plant.id === quickPreviewSpecimen.specimenId) : null
  const selectedPlant = game.state.ownedPlants.find((plant) => plant.id === selectedSpecimenId)
  return <section aria-labelledby="garden-title" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
    <header className="garden-heading"><div><h1 id="garden-title">Garden</h1><p>Your collected specimens</p></div>{!selectionMode && specimens.length > 0 && <button className="cg-button" type="button" onClick={openSelectionMode} aria-pressed={selectionMode}>Select</button>}{selectionMode && <span className="garden-heading__status" aria-live="polite">{selection.selectedCount} selected</span>}</header>
    <GardenDisplaySection description="Your collection is not limited by the six display beds. Choose which owned specimens appear outside.">
      {GARDEN_DISPLAY_SLOT_IDS.map((id) => {
        const specimenId = garden.projection?.displayAssignments[id] ?? null
        return <div key={id} className="garden-display-summary__slot"><strong>{gardenDisplayLabels[id]}</strong><select aria-label={`${gardenDisplayLabels[id]} specimen`} value={specimenId ?? ''} disabled={garden.loading} onChange={(event) => { const value = event.target.value; void garden.mutate(value ? { type: 'assign-display', slotId: id, specimenId: value } : { type: 'clear-display', slotId: id }) }}><option value="">Empty</option>{specimens.map((specimen) => <option key={specimen.specimenId} value={specimen.specimenId}>{getSpeciesById(specimen.speciesId)?.commonName ?? 'Unknown'} — {specimen.specimenId.slice(0, 8)}</option>)}</select></div>
      })}
    </GardenDisplaySection>
    {garden.error && <p role="alert">Garden protection state could not be refreshed. Try reopening the collection.</p>}
    <CollectionTools filters={filters} sort={sort} speciesIds={[...new Set(game.state.ownedPlants.map((plant) => plant.speciesId))]} count={visiblePlants.length} total={specimens.length} onFilters={(next) => { setFilters(next); setPage(0) }} onSort={(next) => { setSort(next); setPage(0) }} />
    {!canUseBulkResearch(game.state.property) && <p>Organized Beds unlocks batch research and breeding shortlists. Favorites always protect your plants.</p>}
    {specimens.length === 0 ? <EmptyState title="No collected plants yet">Collect a mature plant from the Nursery to add it here.</EmptyState> : visiblePlants.length === 0 ? <EmptyState title="No matching specimens">Adjust or reset the collection filters.</EmptyState> :
      <div className="garden-specimens">{displayedPlants.map((plant) => {
        const specimen = specimensById.get(plant.id)
        if (!specimen) return null
        const species = getSpeciesById(specimen.speciesId)
        const selected = selection.isSelected(specimen.specimenId)
        return <article className={`garden-specimen${selected ? ' garden-specimen--selected' : ''}`} key={specimen.specimenId} data-selected={selected ? 'true' : undefined}>
          <button className="garden-specimen__select" type="button" onClick={selectionMode ? () => selection.toggle(specimen.specimenId) : () => setSelectedSpecimenId(specimen.specimenId)} aria-haspopup={selectionMode ? undefined : "dialog"} aria-label={selectionMode ? `${selected ? 'Deselect' : 'Select'} ${species?.commonName ?? 'unknown cactus'} specimen ${specimen.specimenId}` : `View details for ${species?.commonName ?? 'unknown cactus'} specimen ${specimen.specimenId}`} aria-pressed={selectionMode ? selected : undefined} >
            <PlantVisual visual={createPlantVisualDescriptor(specimen)} />
            {selected && <span className="garden-specimen__check" aria-hidden="true">&#10003;</span>}
            <strong>{species?.commonName ?? 'Unknown cactus'}</strong><em>{species?.scientificName}</em>
            <span className="garden-specimen__id">Specimen {specimen.specimenId.slice(0, 8)}</span>
            {tutorial.state?.tutorialParentIds.includes(specimen.specimenId) && <span className="garden-specimen__listed">Tutorial specimen · research / practice only</span>}
            {plant.isListedForSale && <span className="garden-specimen__listed">Listed on Marketplace</span>}
            <CollectionKnowledge plant={plant} research={game.state.geneticsResearch} level={level} />
          </button>
          <FavoriteControl favorite={Boolean(game.state.gardenOrganization[plant.id]?.favorite)} listed={plant.isListedForSale} name={`specimen ${plant.id}`} onChange={(favorite) => game.setGardenFavorite(plant.id, favorite)} />
          <div className="garden-specimen__actions">
            <button className="garden-specimen__quick-view" type="button" onClick={(event) => { event.stopPropagation(); openQuickPreview(specimen.specimenId) }} aria-label={`Quick view ${species?.commonName ?? 'unknown cactus'} specimen ${specimen.specimenId}`}>Quick view</button>
            <button className="garden-specimen__details" type="button" onClick={() => setSelectedSpecimenId(specimen.specimenId)} aria-label={`Full details for ${species?.commonName ?? 'unknown cactus'} specimen ${specimen.specimenId}`}>Details</button>
          </div>
        </article>
      })}</div>}
    {visiblePlants.length > COLLECTION_PAGE_SIZE && <nav className="collection-pagination" aria-label="Collection pages"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {Math.ceil(visiblePlants.length / COLLECTION_PAGE_SIZE)}</span><button type="button" disabled={(currentPage + 1) * COLLECTION_PAGE_SIZE >= visiblePlants.length} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
    {batchResearch && <BulkResearchDialog plants={[...selection.selectedIds].map((id) => plantsById.get(id)).filter((plant) => plant !== undefined)} onClose={() => setBatchResearch(false)} />}
    {selected && selectedPlant && <PlantDetails plant={selectedPlant} species={getSpeciesById(selected.speciesId)} onClose={closeDetails} onBreed={() => { setParentCandidates(undefined); setBreedingParentId(selected.specimenId); setSelectedSpecimenId(null) }} onSell={() => { setSellingPlantId(selected.specimenId); setSelectedSpecimenId(null) }} onResearch={() => { setResearchPlantId(selected.specimenId); setSelectedSpecimenId(null) }} isListed={selectedPlant.isListedForSale} organization={game.state.gardenOrganization[selectedPlant.id]} organizationUnlocked={game.state.property.buildings.garden.level >= 2} onFavoriteChange={(favorite) => game.setGardenFavorite(selectedPlant.id, favorite)} onAddTag={(tag) => game.addGardenTag(selectedPlant.id, tag)} onRemoveTag={(tag) => { void game.removeGardenTag(selectedPlant.id, tag) }} displayAssignments={game.state.gardenDisplayAssignments} onAssignDisplay={(slotId) => { void game.assignGardenDisplay(slotId, selectedPlant.id) }} onClearDisplay={(slotId) => { void game.clearGardenDisplay(slotId) }} />}
    {quickPreviewPlant && quickPreviewSpecimen && <SpecimenQuickPreview plant={quickPreviewPlant} species={getSpeciesById(quickPreviewSpecimen.speciesId)} organization={game.state.gardenOrganization[quickPreviewSpecimen.specimenId] ?? { favorite: false, tags: [] }} onClose={closeQuickPreview} onFullDetails={() => openFullDetailsFromPreview(quickPreviewSpecimen.specimenId)} />}
    {breedingParentId && <ServerBreedingWorkflow parent1Id={breedingParentId} candidateIds={parentCandidates} onClose={() => setBreedingParentId(null)} />}
    {sellingPlantId && <SellWorkflow plantId={sellingPlantId} onClose={() => setSellingPlantId(null)} />}
    {researchPlantId && game.state.ownedPlants.find((plant) => plant.id === researchPlantId) && <ResearchWorkflow plant={game.state.ownedPlants.find((plant) => plant.id === researchPlantId)!} onClose={() => setResearchPlantId(null)} />}
    {multiSellVisible && <MultiSellDialog organization={game.state.gardenOrganization} selectedSpecimenIds={selection.selectedIds} ownedPlants={multiSellPlants} onClose={() => setMultiSellVisible(false)} onSold={handleMultiSellDone} onSellPlant={handleMultiSell} />}
    {selectionMode && <div className="garden-selection-bar" role="toolbar" aria-label="Selection controls">
      <span className="garden-selection-bar__count" aria-live="polite">{selection.selectedCount} {selection.selectedCount === 1 ? 'specimen' : 'specimens'} selected</span>
      <div className="garden-selection-bar__actions">
        <button className="cg-button" type="button" onClick={() => selection.select(displayedPlants.map((plant) => plant.id))}>Select page ({displayedPlants.length})</button>
        <button className="cg-button" type="button" onClick={() => selection.select(visiblePlants.map((plant) => plant.id))}>Select filtered ({visiblePlants.length})</button>
        <ResearchSelectionAction plants={multiSellPlants} research={game.state.geneticsResearch} level={level} property={game.state.property} dialogOpen={batchResearch} onOpen={() => setBatchResearch(true)} />
        <button className="cg-button" type="button" disabled={shortlist.length < 2 || !canUseBulkBreeding(game.state.property)} onClick={() => { setParentCandidates(shortlist.map((plant) => plant.id)); setBreedingParentId(shortlist[0].id) }}>Choose parents ({shortlist.length} eligible)</button>
        {selection.selectedCount > 0 && <button className="cg-button cg-button--sell" type="button" onClick={() => setMultiSellVisible(true)} disabled={selection.selectedCount === 0}>Sell to NPC</button>}
        {selection.selectedCount > 0 && <button className="cg-button cg-button--marketplace" type="button" disabled aria-disabled="true">List on Marketplace</button>}
        {selection.selectedCount > 0 && <button className="cg-button cg-button--ghost" type="button" onClick={selection.clear} disabled={selection.selectedCount === 0}>Clear</button>}
        <button className="cg-button cg-button--ghost" type="button" onClick={closeSelectionMode}>Done</button>
      </div>
    </div>}
  </section>
}
