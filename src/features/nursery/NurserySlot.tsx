import { getSpeciesById } from '../../data/species'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { calculateNurseryGrowth, type NurserySlotState } from './nurseryModel'
import { TreatmentHistory } from '../lab/TreatmentHistory'
import { Badge } from '../../components/ui/Badge'
import { extractTargetLabels } from '../lab/extractionModel'
import { formatGrowthTimeRemaining, getNurseryPlantSilhouette, getNurseryVisualPhase } from './nurseryPresentation'
import { MOCK_GROWTH_DURATION_MS } from './nurseryModel'

interface NurserySlotProps {
  slot: NurserySlotState
  slotNumber: number
  now: number
  onPlant: (slotId: string) => void
  onCollect: (slotId: string) => void
}

export function NurserySlot({
  slot,
  slotNumber,
  now,
  onPlant,
  onCollect,
}: NurserySlotProps) {
  if (!slot.plant) {
    return (
      <article className="nursery-slot nursery-slot--empty">
        <span className="nursery-slot__number">Position {slotNumber}</span>
        <div className="nursery-slot__empty-pot" aria-hidden="true"><span>+</span></div>
        <h2>Available pot</h2>
        <p>Ready for a seed.</p>
        <button className="nursery-button" type="button" onClick={() => onPlant(slot.id)}>
          Plant Seed
        </button>
      </article>
    )
  }

  const species = getSpeciesById(slot.plant.speciesId)
  const growth = calculateNurseryGrowth(slot.plant.plantedAt, now)
  const percent = Math.round(growth.progress * 100)
  const silhouette = getNurseryPlantSilhouette(species)
  const visualPhase = getNurseryVisualPhase(growth.progress)
  const shiny = slot.plant.specialVariants.some(({ variantId }) => variantId === 'shiny')
  const treatment = slot.plant.quantitativeTreatments?.find(({ status }) => status === 'resolved')
  const remainingLabel = formatGrowthTimeRemaining(slot.plant.plantedAt, now, MOCK_GROWTH_DURATION_MS)

  return (
    <article className="nursery-slot">
      <div className="nursery-slot__topline">
        <span className="nursery-slot__number">Position {slotNumber}</span>
        <Badge tone={growth.isMature ? 'success' : 'neutral'}>{growth.isMature ? 'Ready to collect' : growth.stage}</Badge>
      </div>
      <div className={`nursery-plant nursery-plant--${silhouette} nursery-plant--phase-${visualPhase}${shiny ? ' nursery-plant--shiny' : ''}`} aria-hidden="true">
        <span className="nursery-plant__shadow" />
        <span className="nursery-plant__pot" />
        <span className="nursery-plant__body" />
      </div>
      <div className="nursery-slot__badges">
        {shiny && <Badge tone="warning">Shiny</Badge>}
        {slot.plant.isHybrid && <Badge tone="accent">Hybrid</Badge>}
        {treatment && <Badge tone="warning">Treated</Badge>}
      </div>
      <h2>{species?.commonName ?? 'Unknown cactus'}</h2>
      <span className="nursery-slot__scientific">{species?.scientificName}</span>
      <dl className="nursery-slot__details">
        <div><dt>Planted</dt><dd>{new Date(slot.plant.plantedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</dd></div>
        <div><dt>Time</dt><dd>{remainingLabel}</dd></div>
      </dl>
      <ProgressBar value={percent} max={100} label="Growth" />
      {treatment?.resolution ? <div className="nursery-treatment" title={`Resolved treatment from extract ${treatment.extractId}`}><span>{extractTargetLabels[treatment.target]}</span><strong>{treatment.resolution.originalValue} → {treatment.resolution.finalValue}</strong><Badge tone="success">+{treatment.resolution.gain}</Badge></div> : <TreatmentHistory treatments={slot.plant.quantitativeTreatments} compact />}
      {growth.isMature && (
        <button className="nursery-button nursery-button--collect" type="button" onClick={(event) => { event.currentTarget.disabled = true; onCollect(slot.id) }}>
          Collect Plant
        </button>
      )}
    </article>
  )
}
