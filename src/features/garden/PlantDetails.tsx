import { useEffect, useRef } from 'react'
import type { CollectedPlant } from '../../game/gameState'
import type { Species } from '../../types/species'

interface PlantDetailsProps {
  plant: CollectedPlant
  species: Species | undefined
  onClose: () => void
  onBreed: () => void
}

const detailFields = [
  ['Vigor', 'vigor'],
  ['Growth speed', 'growthSpeed'],
  ['Size', 'size'],
  ['Flowering', 'flowering'],
  ['Mutation chance', 'mutationChance'],
] as const

export function PlantDetails({ plant, species, onClose, onBreed }: PlantDetailsProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div className="plant-details-overlay">
      <button
        className="plant-details__backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close plant details"
      />
      <section
        className="plant-details"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plant-details-title"
      >
        <header className="plant-details__header">
          <div>
            <span className="eyebrow">Collected specimen</span>
            <h2 id="plant-details-title">{species?.commonName ?? 'Unknown cactus'}</h2>
            {species?.scientificName && <em>{species.scientificName}</em>}
          </div>
          <button
            className="plant-details__close"
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close plant details"
          >
            ×
          </button>
        </header>

        <dl className="plant-details__identity">
          <div><dt>Specimen ID</dt><dd>{plant.id}</dd></div>
          <div><dt>Stage</dt><dd>{plant.stage}</dd></div>
          {species && <div><dt>Rarity</dt><dd>{species.rarity}</dd></div>}
          <div><dt>Planted</dt><dd>{new Date(plant.plantedAt).toLocaleString()}</dd></div>
          <div><dt>Collected</dt><dd>{new Date(plant.collectedAt).toLocaleString()}</dd></div>
        </dl>

        <section className="plant-details__section" aria-labelledby="genetics-title">
          <h3 id="genetics-title">Genetics</h3>
          <dl className="plant-details__genetics">
            {detailFields.map(([label, key]) => (
              <div key={key}><dt>{label}</dt><dd>{plant.genetics[key]}</dd></div>
            ))}
          </dl>
        </section>

        <section className="plant-details__section" aria-labelledby="lineage-title">
          <h3 id="lineage-title">Lineage</h3>
          {plant.parentPlantIds ? (
            <ul className="plant-details__parents">
              {plant.parentPlantIds.map((parentId) => <li key={parentId}>{parentId}</li>)}
            </ul>
          ) : (
            <p className="plant-details__missing">No parent specimens recorded.</p>
          )}
        </section>

        <footer className="plant-details__actions">
          <span>Future specimen actions</span>
          <div>
            <button className="plant-details__primary-action" type="button" onClick={onBreed}>Breed</button>
            <button type="button" disabled>Sell · Coming later</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
