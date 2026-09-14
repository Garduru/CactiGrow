import type { ResolvedWorldBuilding } from './locations'
import { LocationArt } from './LocationArt'

interface WorldBuildingButtonProps {
  building: ResolvedWorldBuilding
  onEnter: () => void
}

export function WorldBuildingButton({ building, onEnter }: WorldBuildingButtonProps) {
  return (
    <button
      type="button"
      className={`farm-location farm-location--${building.id}`}
      data-visual-key={building.visualKey}
      aria-label={`Enter ${building.displayName}, ${building.id === 'lab' ? `tier ${building.currentTier?.id ?? building.level}` : `level ${building.level}`}`}
      onClick={onEnter}
    >
      <LocationArt location={building.id} />
      <span className="farm-location__ground" aria-hidden="true" />
      <span className="farm-location__name" aria-hidden="true">{building.label}</span>
    </button>
  )
}
