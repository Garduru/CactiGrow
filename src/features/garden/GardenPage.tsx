import { useCallback, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import { PlantDetails } from './PlantDetails'

export function GardenPage() {
  const { state } = useGameState()
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null)
  const selectedPlant = state.ownedPlants.find((plant) => plant.id === selectedPlantId)
  const closeDetails = useCallback(() => setSelectedPlantId(null), [])

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
                  onClick={() => setSelectedPlantId(plant.id)}
                  aria-haspopup="dialog"
                  aria-label={`View details for ${plantSpecies?.commonName ?? 'unknown cactus'} specimen ${plant.id}`}
                >
                  <span className="nursery-stage nursery-stage--mature">{plant.stage}</span>
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
        />
      )}
    </section>
  )
}
