import { getSpeciesById } from '../../data/species'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { calculateNurseryGrowth, type NurserySlotState } from './nurseryModel'

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
        <span className="nursery-slot__number">Grow slot {slotNumber}</span>
        <div className="nursery-slot__empty-mark" aria-hidden="true">+</div>
        <h2>Empty pot</h2>
        <p>Choose a seed to start growing.</p>
        <button className="nursery-button" type="button" onClick={() => onPlant(slot.id)}>
          Plant a seed
        </button>
      </article>
    )
  }

  const species = getSpeciesById(slot.plant.speciesId)
  const growth = calculateNurseryGrowth(slot.plant.plantedAt, now)
  const percent = Math.round(growth.progress * 100)

  return (
    <article className="nursery-slot">
      <div className="nursery-slot__topline">
        <span className="nursery-slot__number">Grow slot {slotNumber}</span>
        <span className={`nursery-stage nursery-stage--${growth.stage}`}>{growth.stage}</span>
      </div>
      <div className={`nursery-plant nursery-plant--${growth.stage}`} aria-hidden="true">
        <span className="nursery-plant__pot" />
        <span className="nursery-plant__body" />
      </div>
      <h2>{species?.commonName ?? 'Unknown cactus'}</h2>
      <span className="nursery-slot__scientific">{species?.scientificName}</span>
      <dl className="nursery-slot__details">
        <div><dt>Planted</dt><dd>{new Date(slot.plant.plantedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</dd></div>
        <div><dt>Stage</dt><dd>{growth.stage}</dd></div>
      </dl>
      <ProgressBar value={percent} max={100} label="Growth" />
      {growth.isMature ? (
        <button className="nursery-button" type="button" onClick={() => onCollect(slot.id)}>
          Collect plant
        </button>
      ) : (
        <span className="nursery-slot__growing">Growing · {percent}%</span>
      )}
    </article>
  )
}
