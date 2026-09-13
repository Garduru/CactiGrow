import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'

export function GardenPage() {
  const { state } = useGameState()

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
                <span className="nursery-stage nursery-stage--mature">{plant.stage}</span>
                <h2>{plantSpecies?.commonName ?? 'Unknown cactus'}</h2>
                <em>{plantSpecies?.scientificName}</em>
                <dl>
                  <div><dt>Specimen</dt><dd>{plant.id}</dd></div>
                  <div><dt>Collected</dt><dd>{new Date(plant.collectedAt).toLocaleString()}</dd></div>
                </dl>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
