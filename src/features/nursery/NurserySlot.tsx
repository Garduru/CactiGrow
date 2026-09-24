import { useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { calculateNurseryGrowth, type NurserySlotState } from './nurseryModel'
import { TreatmentHistory } from '../lab/TreatmentHistory'
import { Badge } from '../../components/ui/Badge'
import { extractTargetLabels } from '../lab/extractionModel'
import { formatGrowthTimeRemaining, getNurseryPresentationStage } from './nurseryPresentation'
import { MOCK_GROWTH_DURATION_MS } from './nurseryModel'
import { createPlantVisualDescriptor } from '../plants/plantVisualModel'
import { PlantVisual } from '../../components/ui/PlantVisual'
import type { VariegationPattern } from '../../types/plantVisual'

interface NurserySlotProps {
  slot: NurserySlotState
  slotNumber: number
  now: number
  onPlant: (slotId: string) => void
  onCollect: (slotId: string) => void | boolean | Promise<boolean>
  readOnly?: boolean
  variegationPattern?: VariegationPattern
  growthDurationMs?: number
}

export function NurserySlot({
  slot,
  slotNumber,
  now,
  onPlant,
  onCollect,
  readOnly = false,
  variegationPattern,
  growthDurationMs = MOCK_GROWTH_DURATION_MS,
}: NurserySlotProps) {
  const submitting = useRef(false)
  const [collecting, setCollecting] = useState(false)
  const [collectionError, setCollectionError] = useState('')

  async function collectPlant() {
    if (submitting.current) return
    submitting.current = true
    setCollecting(true)
    setCollectionError('')
    try {
      if (await onCollect(slot.id) === false) setCollectionError('Collection could not be completed. Please try again.')
    } catch {
      setCollectionError('Collection could not be completed. Please try again.')
    } finally {
      submitting.current = false
      setCollecting(false)
    }
  }

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
  const elapsed = Math.max(0, now - Date.parse(slot.plant.plantedAt))
  const growth = growthDurationMs > 0 ? { progress: Math.min(elapsed / growthDurationMs, 1), isMature: elapsed >= growthDurationMs } : calculateNurseryGrowth(slot.plant.plantedAt, now)
  const percent = Math.round(growth.progress * 100)
  const presentationStage = getNurseryPresentationStage(growth)
  const visual = presentationStage === 'germinating' ? null : createPlantVisualDescriptor(slot.plant, presentationStage, { variegationPattern })
  const shiny = slot.plant.specialVariants.some(({ variantId }) => variantId === 'shiny')
  const treatment = slot.plant.quantitativeTreatments?.find(({ status }) => status === 'resolved')
  const remainingLabel = formatGrowthTimeRemaining(slot.plant.plantedAt, now, growthDurationMs)

  return (
    <article className="nursery-slot">
      <div className="nursery-slot__topline">
        <span className="nursery-slot__number">Position {slotNumber}</span>
        <Badge tone={growth.isMature ? 'success' : 'neutral'}>{growth.isMature ? 'Ready to collect' : presentationStage}</Badge>
      </div>
      <div className="nursery-plant" aria-hidden="true">
        <span className="nursery-plant__pot" />
        {visual && <span className="nursery-plant__visual"><PlantVisual visual={visual} size={visual.baseAsset ? 72 : visual.visualStage === 'seedling' ? 34 : visual.visualStage === 'juvenile' ? 49 : visual.visualStage === 'developing' ? 61 : 72} /></span>}
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
      <ProgressBar value={percent} max={100} displayValue={`${percent}%`} ariaLabel="Growth progress" />
      {treatment?.resolution ? <div className="nursery-treatment" title={`Resolved treatment from extract ${treatment.extractId}`}><span>{extractTargetLabels[treatment.target]}</span><strong>{treatment.resolution.originalValue} → {treatment.resolution.finalValue}</strong><Badge tone="success">+{treatment.resolution.gain}</Badge></div> : <TreatmentHistory treatments={slot.plant.quantitativeTreatments} compact />}
      {collectionError && <p role="alert">{collectionError}</p>}
      {growth.isMature && !readOnly && (
        <button className="nursery-button nursery-button--collect" type="button" disabled={collecting} onClick={() => void collectPlant()}>
          {collecting ? 'Collecting...' : 'Collect Plant'}
        </button>
      )}
    </article>
  )
}
