import { useCallback, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import { PlantDetails } from './PlantDetails'
import { BreedingWorkflow } from '../breeding/BreedingWorkflow'
import { SellWorkflow } from '../marketplace/SellWorkflow'
import { getListingForPlant } from '../../game/gameState'
import { ResearchWorkflow } from '../research/ResearchWorkflow'

export function GardenPage() {
  const { state } = useGameState()
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null)
  const [breedingParentId, setBreedingParentId] = useState<string | null>(null)
  const [sellingPlantId, setSellingPlantId] = useState<string | null>(null)
  const [researchPlantId, setResearchPlantId] = useState<string | null>(null)
  const specimenRefs = useRef(new Map<string, HTMLButtonElement>())
  const selectedPlant = state.ownedPlants.find((plant) => plant.id === selectedPlantId)
  const researchPlant = state.ownedPlants.find((plant) => plant.id === researchPlantId)
  const closeDetails = useCallback(() => setSelectedPlantId(null), [])
  const closeBreeding = useCallback(() => {
    const parentId = breedingParentId
    setBreedingParentId(null)
    requestAnimationFrame(() => { if (parentId) specimenRefs.current.get(parentId)?.focus() })
  }, [breedingParentId])
  const closeSelling = useCallback(() => {
    const plantId = sellingPlantId
    setSellingPlantId(null)
    requestAnimationFrame(() => { if (plantId) specimenRefs.current.get(plantId)?.focus() })
  }, [sellingPlantId])
  const closeResearch = useCallback(() => {
    const plantId = researchPlantId
    setResearchPlantId(null)
    requestAnimationFrame(() => { if (plantId) specimenRefs.current.get(plantId)?.focus() })
  }, [researchPlantId])

  return (
    <section aria-labelledby="garden-title">
      <h1 id="garden-title">Garden</h1>
      <p>Your collected specimens appear here.</p>
      {state.ownedPlants.length === 0 ? (
        <div className="garden-empty">
          <strong>No collected plants yet</strong>
          <span>Collect a mature plant from the Nursery to add it here.</span>
        </div>
      ) : (
        <div className="garden-specimens">
          {state.ownedPlants.map((plant) => {
            const plantSpecies = getSpeciesById(plant.speciesId)
            return (
              <article className="garden-specimen" key={plant.id}>
                <button
                  className="garden-specimen__select"
                  type="button"
                  ref={(node) => { if (node) specimenRefs.current.set(plant.id, node); else specimenRefs.current.delete(plant.id) }}
                  onClick={() => setSelectedPlantId(plant.id)}
                  aria-haspopup="dialog"
                  aria-label={`View details for ${plantSpecies?.commonName ?? 'unknown cactus'} specimen ${plant.id}`}
                >
                  <span className="nursery-stage nursery-stage--mature">{plant.stage}</span>
                  {plant.isListedForSale && <span className="garden-specimen__listed">Listed on Marketplace</span>}
                  <strong>{plantSpecies?.commonName ?? 'Unknown cactus'}</strong>
                  <em>{plantSpecies?.scientificName}</em>
                  <span className="garden-specimen__id">Specimen {plant.id}</span>
                  <span className="garden-specimen__prompt">View details →</span>
                </button>
              </article>
            )
          })}
        </div>
      )}

      {selectedPlant && (
        <PlantDetails
          plant={selectedPlant}
          species={getSpeciesById(selectedPlant.speciesId)}
          onClose={closeDetails}
          onBreed={() => { setBreedingParentId(selectedPlant.id); setSelectedPlantId(null) }}
          onSell={() => { setSellingPlantId(selectedPlant.id); setSelectedPlantId(null) }}
          onResearch={() => { setResearchPlantId(selectedPlant.id); setSelectedPlantId(null) }}
          isListed={Boolean(getListingForPlant(state.marketplaceListings, selectedPlant.id))}
        />
      )}
      {breedingParentId && <BreedingWorkflow parent1Id={breedingParentId} onClose={closeBreeding} />}
      {sellingPlantId && <SellWorkflow plantId={sellingPlantId} onClose={closeSelling} />}
      {researchPlant && <ResearchWorkflow plant={researchPlant} onClose={closeResearch} />}
    </section>
  )
}
