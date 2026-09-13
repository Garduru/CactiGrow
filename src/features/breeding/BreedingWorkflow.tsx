import { useEffect, useMemo, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import type { CollectedPlant } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import type { BredSeed } from '../../types/bredSeed'
import { previewOffspringGenetics } from './breedingModel'

interface BreedingWorkflowProps {
  parent1Id: string
  onClose: () => void
}

const traits = [
  ['Vigor', 'vigor'],
  ['Growth', 'growthSpeed'],
  ['Size', 'size'],
  ['Flowering', 'flowering'],
  ['Mutation', 'mutationChance'],
] as const

function ParentCard({ plant }: { plant: CollectedPlant }) {
  const species = getSpeciesById(plant.speciesId)

  return (
    <div className="breeding-parent">
      <strong>{species?.commonName ?? 'Unknown cactus'}</strong>
      <em>{species?.scientificName}</em>
      <small>{plant.id}</small>
      <div className="breeding-traits">
        {traits.map(([label, key]) => <span key={key}>{label} <b>{plant.genetics[key]}</b></span>)}
      </div>
      {plant.parentPlantIds && <small>Parents: {plant.parentPlantIds.join(' + ')}</small>}
    </div>
  )
}

export function BreedingWorkflow({ parent1Id, onClose }: BreedingWorkflowProps) {
  const { state, breedPlants } = useGameState()
  const [parent2Id, setParent2Id] = useState<string | null>(null)
  const [result, setResult] = useState<BredSeed | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const parent1 = state.ownedPlants.find((plant) => plant.id === parent1Id)
  const parent2 = state.ownedPlants.find((plant) => plant.id === parent2Id)
  const eligible = state.ownedPlants.filter((plant) => (
    plant.id !== parent1Id && plant.stage === 'mature' && !plant.isListedForSale
  ))
  const preview = useMemo(
    () => parent1 && parent2 ? previewOffspringGenetics(parent1, parent2) : null,
    [parent1, parent2],
  )

  useEffect(() => {
    closeRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
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

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!parent1) return null

  function confirmBreed() {
    if (!parent2Id) return
    const seed = breedPlants(parent1Id, parent2Id)
    if (seed) setResult(seed)
  }

  return (
    <div className="breeding-overlay">
      <button
        className="plant-details__backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close breeding workflow"
      />
      <section
        className="breeding-workflow"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="breeding-title"
      >
        <header className="plant-details__header">
          <div>
            <span className="eyebrow">Garden workflow</span>
            <h2 id="breeding-title">Breed a new seed</h2>
          </div>
          <button
            className="plant-details__close"
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close breeding workflow"
          >
            &times;
          </button>
        </header>

        {result ? (
          <div className="breeding-result">
            <span className="nursery-stage nursery-stage--mature">Seed created</span>
            <h3>{getSpeciesById(result.speciesId)?.commonName ?? 'Offspring'} seed</h3>
            <p>Added to Inventory as a unique bred seed.</p>
            <div className="breeding-traits">
              {traits.map(([label, key]) => <span key={key}>{label} <b>{result.genetics[key]}</b></span>)}
            </div>
            <small>Parents: {result.parentPlantIds.join(' + ')}</small>
            <button className="nursery-button" type="button" onClick={onClose}>Finish</button>
          </div>
        ) : (
          <>
            <section className="breeding-section">
              <h3>Parent 1</h3>
              <ParentCard plant={parent1} />
            </section>

            {!parent2 ? (
              <section className="breeding-section">
                <h3>Choose Parent 2</h3>
                {eligible.length ? (
                  <div className="breeding-candidates">
                    {eligible.map((plant) => (
                      <button type="button" key={plant.id} onClick={() => setParent2Id(plant.id)}>
                        <ParentCard plant={plant} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="breeding-empty">
                    No other mature specimens are eligible yet. Collect another plant from the Nursery first.
                  </p>
                )}
              </section>
            ) : (
              <>
                <section className="breeding-section">
                  <div className="breeding-section__heading">
                    <h3>Parent review</h3>
                    <button type="button" onClick={() => setParent2Id(null)}>Change Parent 2</button>
                  </div>
                  <div className="breeding-comparison">
                    <ParentCard plant={parent1} />
                    <ParentCard plant={parent2} />
                  </div>
                </section>
                <section className="breeding-section">
                  <h3>Expected offspring</h3>
                  <p>Values center on both parents. Final inheritance includes bounded variation and a chance of mutation.</p>
                  {preview && (
                    <div className="breeding-preview">
                      {traits.map(([label, key]) => (
                        <span key={key}>{label}<strong>About {preview[key]}</strong></span>
                      ))}
                    </div>
                  )}
                  <button className="nursery-button" type="button" onClick={confirmBreed}>
                    Confirm breeding
                  </button>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
