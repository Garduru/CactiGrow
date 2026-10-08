import { useEffect, useRef } from 'react'
import type { CollectedPlant } from '../../game/gameState'
import type { Species } from '../../types/species'
import { getSpeciesById } from '../../data/species'
import { getGeneticFeatureDefinition } from '../../data/geneticFeatures'
import { getExpressedGeneticFeatures } from '../genetics/geneticFeatureModel'
import type { GardenSpecimenOrganization } from '../../types/garden'
import { GardenOrganizationControls } from './GardenOrganizationControls'
import { TreatmentHistory } from '../lab/TreatmentHistory'
import { GardenDisplayControls } from './GardenDisplayControls'
import { FavoriteControl } from './FavoriteControl'
import { CollectionKnowledge } from './CollectionKnowledge'
import { useGameState } from '../../game/useGameState'
import { getLevelFromXp } from '../progression/progressionModel'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { createPlantVisualDescriptor } from '../plants/plantVisualModel'
import type { GardenDisplayAssignments, GardenDisplaySlotId } from '../../types/garden'
import type { VariegationPattern, VisualGrowthStage } from '../../types/plantVisual'
import type { PlantSpecimenV1 } from '../../../shared/api/plantLifecycleV1'
import type { PlantSpecimenV2 } from '../../../shared/api/plantLifecycleV2'

interface LocalPlantDetailsProps {
  plant: CollectedPlant
  species: Species | undefined
  onClose: () => void
  onBreed: () => void
  onSell: () => void
  onResearch: () => void
  isListed: boolean
  organization?: GardenSpecimenOrganization
  organizationUnlocked: boolean
  onFavoriteChange: (favorite: boolean) => boolean | void | Promise<boolean | void>
  onAddTag: (tag: string) => boolean | Promise<boolean>
  onRemoveTag: (tag: string) => void
  displayAssignments: GardenDisplayAssignments
  onAssignDisplay: (slotId: GardenDisplaySlotId) => void
  onClearDisplay: (slotId: GardenDisplaySlotId) => void
  readOnly?: boolean
  previewVisualStage?: VisualGrowthStage
  previewVariegationPattern?: VariegationPattern
}

interface ServerPlantDetailsProps {
  plant: PlantSpecimenV1 | PlantSpecimenV2
  species: Species | undefined
  onClose: () => void
  readOnly: true
  onBreed?: () => void
}

type PlantDetailsProps = LocalPlantDetailsProps | ServerPlantDetailsProps

const detailFields = [
  ['Vigor', 'vigor'],
  ['Growth speed', 'growthSpeed'],
  ['Size', 'size'],
  ['Flowering', 'flowering'],
  ['Mutation tendency', 'mutationChance'],
] as const

function DetailKnowledge({ plant }: { plant: CollectedPlant }) {
  const game = useGameState()
  return <CollectionKnowledge plant={plant} research={game.state.geneticsResearch} level={getLevelFromXp(game.state.player.skills.genetics.xp)} />
}

export function PlantDetails(props: PlantDetailsProps) {
  const { plant, species, onClose } = props
  const localPlant = 'specimenId' in plant ? null : plant
  const serverPlant = 'specimenId' in plant ? plant : null
  const localProps = localPlant ? props as LocalPlantDetailsProps : null
  const local = props.readOnly ? null : localProps
  const specimenId = 'specimenId' in plant ? plant.specimenId : plant.id
  const stage = localPlant?.stage ?? 'mature'
  const previewVisualStage = localProps?.previewVisualStage
  const previewVariegationPattern = localProps?.previewVariegationPattern
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

        <div className="plant-details__preview"><PlantVisual visual={createPlantVisualDescriptor(plant, previewVisualStage, { variegationPattern: previewVariegationPattern })} size={100} /></div>
        <dl className="plant-details__identity">
          <div><dt>Specimen ID</dt><dd>{specimenId}</dd></div>
          {(props.readOnly || stage !== 'mature') && <div><dt>Stage</dt><dd>{previewVisualStage ?? stage}</dd></div>}
          {species && <div><dt>Rarity</dt><dd>{species.rarity}</dd></div>}
          {(localPlant?.isHybrid || (serverPlant && 'isHybrid' in serverPlant && serverPlant.isHybrid)) && <div><dt>Type</dt><dd>Same-genus hybrid</dd></div>}
          <div><dt>Planted</dt><dd>{new Date(plant.plantedAt).toLocaleString()}</dd></div>
          <div><dt>Collected</dt><dd>{plant.collectedAt ? new Date(plant.collectedAt).toLocaleString() : 'Not recorded'}</dd></div>
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
          {(localPlant?.isHybrid && localPlant.parentSpeciesIds || (serverPlant && 'parentSpeciesIds' in serverPlant && serverPlant.parentSpeciesIds)) && (
            <dl className="plant-details__identity">
              {(localPlant?.parentSpeciesIds ?? (serverPlant && 'parentSpeciesIds' in serverPlant ? serverPlant.parentSpeciesIds : null))!.map((speciesId, index) => {
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
          {(localPlant?.parentPlantIds || (serverPlant && 'parentPlantIds' in serverPlant && serverPlant.parentPlantIds)) ? (
            <ul className="plant-details__parents">
              {(localPlant?.parentPlantIds ?? (serverPlant && 'parentPlantIds' in serverPlant ? serverPlant.parentPlantIds : null))!.map((parentId) => <li key={parentId}>{parentId}</li>)}
            </ul>
          ) : (
            <p className="plant-details__missing">No parent specimens recorded.</p>
          )}
        </section>

        {local && <GardenDisplayControls plantId={local.plant.id} assignments={local.displayAssignments} onAssign={local.onAssignDisplay} onClear={local.onClearDisplay} />}
        {local && <FavoriteControl favorite={Boolean(local.organization?.favorite)} listed={local.isListed} name={`specimen ${specimenId}`} onChange={local.onFavoriteChange} />}
        {local && <DetailKnowledge plant={local.plant} />}
        {local && local.organizationUnlocked && <GardenOrganizationControls metadata={local.organization} onAddTag={local.onAddTag} onRemoveTag={local.onRemoveTag} />}
        {local && <TreatmentHistory treatments={local.plant.quantitativeTreatments} />}

        {local && <footer className="plant-details__actions">
          <span>{local.isListed ? 'Listed on Marketplace' : 'Specimen actions'}</span>
          <div>
            <button className="plant-details__primary-action" type="button" data-tutorial-target={`study:${specimenId}`} onClick={local.onResearch}>Study Genetics</button>
            <button className="plant-details__primary-action" type="button" data-tutorial-target={`breed:${specimenId}`} onClick={local.onBreed} disabled={local.isListed}>Breed</button>
            <button className="plant-details__primary-action" type="button" onClick={local.onSell} disabled={local.isListed || local.organization?.favorite} title={local.organization?.favorite ? 'Unfavorite this plant before selling.' : undefined}>Sell</button>
          </div>
        </footer>}
        {serverPlant && props.readOnly && props.onBreed && <footer className="plant-details__actions"><span>Specimen actions</span><div><button className="plant-details__primary-action" type="button" onClick={props.onBreed}>Breed</button></div></footer>}
      </section>
    </div>
  )
}
