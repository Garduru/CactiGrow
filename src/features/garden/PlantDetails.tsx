import { useEffect, useRef } from 'react'
import type { CollectedPlant } from '../../game/gameState'
import type { Species } from '../../types/species'
import { getSpeciesById } from '../../data/species'
import { getGeneticFeatureDefinition } from '../../data/geneticFeatures'
import { getExpressedGeneticFeatures } from '../genetics/geneticFeatureModel'
import type { GardenSpecimenOrganization } from '../../types/garden'
import { GardenOrganizationControls } from './GardenOrganizationControls'
import { TreatmentHistory } from '../lab/TreatmentHistory'

interface PlantDetailsProps {
  plant: CollectedPlant
  species: Species | undefined
  onClose: () => void
  onBreed: () => void
  onSell: () => void
  onResearch: () => void
  isListed: boolean
  organization?: GardenSpecimenOrganization
  organizationUnlocked: boolean
  onFavoriteChange: (favorite: boolean) => void
  onAddTag: (tag: string) => boolean
  onRemoveTag: (tag: string) => void
}

const detailFields = [
  ['Vigor', 'vigor'],
  ['Growth speed', 'growthSpeed'],
  ['Size', 'size'],
  ['Flowering', 'flowering'],
  ['Mutation tendency', 'mutationChance'],
] as const

export function PlantDetails({ plant, species, onClose, onBreed, onSell, onResearch, isListed, organization, organizationUnlocked, onFavoriteChange, onAddTag, onRemoveTag }: PlantDetailsProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const expressedFeatures = getExpressedGeneticFeatures(plant.geneticFeatures)

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
          {plant.isHybrid && <div><dt>Type</dt><dd>Same-genus hybrid</dd></div>}
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

        <section className="plant-details__section" aria-labelledby="genetic-identity-title">
          <h3 id="genetic-identity-title">Genetic Identity</h3>
          <dl className="plant-details__identity">
            <div><dt>Clone line</dt><dd>{plant.cloneLineId}</dd></div>
            <div><dt>Special variant</dt><dd>{plant.specialVariants.some(({ variantId }) => variantId === 'shiny') ? 'Shiny' : 'Normal'}</dd></div>
          </dl>
          <h3 className="plant-details__subheading">Visible Traits / Mutations</h3>
          {expressedFeatures.length ? (
            <ul className="plant-details__features">
              {expressedFeatures.map((feature) => {
                const definition = getGeneticFeatureDefinition(feature.featureId)
                return <li key={feature.featureId}>{definition?.displayName ?? feature.featureId} ({feature.expressionStrength}%)</li>
              })}
            </ul>
          ) : (
            <p className="plant-details__missing">None visibly expressed.</p>
          )}
        </section>

        <section className="plant-details__section" aria-labelledby="lineage-title">
          <h3 id="lineage-title">Lineage</h3>
          {plant.isHybrid && plant.parentSpeciesIds && (
            <dl className="plant-details__identity">
              {plant.parentSpeciesIds.map((speciesId, index) => {
                const parentSpecies = getSpeciesById(speciesId)
                return (
                  <div key={`${speciesId}-${index}`}>
                    <dt>Parent species {index + 1}</dt>
                    <dd>{parentSpecies?.scientificName ?? speciesId}</dd>
                  </div>
                )
              })}
            </dl>
          )}
          {plant.parentPlantIds ? (
            <ul className="plant-details__parents">
              {plant.parentPlantIds.map((parentId) => <li key={parentId}>{parentId}</li>)}
            </ul>
          ) : (
            <p className="plant-details__missing">No parent specimens recorded.</p>
          )}
        </section>

        {organizationUnlocked && <GardenOrganizationControls metadata={organization} onFavoriteChange={onFavoriteChange} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />}
        <TreatmentHistory treatments={plant.quantitativeTreatments} />

        <footer className="plant-details__actions">
          <span>{isListed ? 'Listed on Marketplace' : 'Specimen actions'}</span>
          <div>
            <button className="plant-details__primary-action" type="button" onClick={onResearch}>Study Genetics</button>
            <button className="plant-details__primary-action" type="button" onClick={onBreed} disabled={isListed}>Breed</button>
            <button className="plant-details__primary-action" type="button" onClick={onSell} disabled={isListed}>Sell</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
