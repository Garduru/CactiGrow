import { useRef } from 'react'
import { useModalFocus } from '../../components/ui/useModalFocus'
import type { CollectedPlant } from '../../game/gameState'
import type { Species } from '../../types/species'
import type { GardenSpecimenOrganization } from '../../types/garden'
import { getGeneticFeatureDefinition } from '../../data/geneticFeatures'
import { getExpressedGeneticFeatures } from '../../features/genetics/geneticFeatureModel'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { createPlantVisualDescriptor } from '../../features/plants/plantVisualModel'

interface SpecimenQuickPreviewProps {
  plant: CollectedPlant
  species: Species | undefined
  organization: GardenSpecimenOrganization
  onClose: () => void
  onFullDetails: () => void
}

export function SpecimenQuickPreview({ plant, species, organization, onClose, onFullDetails }: SpecimenQuickPreviewProps) {
  const panelRef = useRef<HTMLElement>(null)
  useModalFocus(panelRef, onClose)
  const expressedFeatures = getExpressedGeneticFeatures(plant.geneticFeatures)
  const isShiny = plant.specialVariants.some(({ variantId }) => variantId === 'shiny')
  const isHybrid = plant.isHybrid === true

  return (
    <div className="specimen-quick-preview-overlay">
      <button
        className="specimen-quick-preview__backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close quick preview"
        tabIndex={-1}
      />
      <section
        className="specimen-quick-preview"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-preview-title"
      >
        <header className="specimen-quick-preview__header">
          <div>
            <span className="eyebrow">Quick view</span>
            <h2 id="quick-preview-title">{species?.commonName ?? 'Unknown cactus'}</h2>
            {species?.scientificName && <em>{species.scientificName}</em>}
          </div>
          <button
            className="specimen-quick-preview__close"
            type="button"
            onClick={onClose}
            aria-label="Close quick preview"
          >
            &times;
          </button>
        </header>

        <div className="specimen-quick-preview__visual">
          <PlantVisual visual={createPlantVisualDescriptor(plant)} size={100} />
        </div>

        <dl className="specimen-quick-preview__info">
          <div><dt>Rarity</dt><dd>{species?.rarity ?? '—'}</dd></div>
          {isShiny && <div><dt>Shiny</dt><dd className="shiny-indicator">★ Shiny</dd></div>}
          {organization.favorite && <div><dt>Favorites</dt><dd className="favorite-indicator">★ Favorite</dd></div>}
          {isHybrid && <div><dt>Type</dt><dd>Same-genus hybrid</dd></div>}
          {expressedFeatures.length > 0 && (
            <div className="specimen-quick-preview__traits">
              <dt>Expressed traits</dt>
              <dd>
                <ul>
                  {expressedFeatures.slice(0, 4).map((feature) => {
                    const definition = getGeneticFeatureDefinition(feature.featureId)
                    return (
                      <li key={feature.featureId}>
                        {definition?.displayName ?? feature.featureId} ({feature.expressionStrength}%)
                      </li>
                    )
                  })}
                </ul>
              </dd>
            </div>
          )}
          {organization.tags.length > 0 && (
            <div className="specimen-quick-preview__tags">
              <dt>Tags</dt>
              <dd>{organization.tags.join(' · ')}</dd>
            </div>
          )}
        </dl>

        <footer className="specimen-quick-preview__actions">
          <button className="specimen-quick-preview__primary-action" type="button" onClick={onFullDetails}>
            Full details
          </button>
        </footer>
      </section>
    </div>
  )
}
