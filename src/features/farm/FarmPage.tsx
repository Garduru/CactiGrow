import { useCallback, useState } from 'react'
import { useGameState } from '../../game/useGameState'
import { BuildingDetails } from './BuildingDetails'
import { LocationArt } from './LocationArt'
import { farmLocations, resolveWorldBuilding, type FarmLocationId } from './locations'

export function FarmPage() {
  const { state } = useGameState()
  const [selectedId, setSelectedId] = useState<FarmLocationId | null>(null)
  const closeDetails = useCallback(() => setSelectedId(null), [])
  const buildings = farmLocations.map((building) => resolveWorldBuilding(building, state.geneticsLab.tier))
  const selectedBuilding = buildings.find((building) => building.id === selectedId)

  return (
    <section className="farm" aria-label="Farm">
      <div className="farm-world" aria-label="Farm locations">
        <svg className="farm-world__terrain" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 140 130 60 213 109 328 35 440 133 582 65 690 119 829 41 1000 130V600H0Z" fill="#392d24" opacity=".5" />
          <path d="M500 640V310M500 310Q420 245 220 180M500 310Q580 245 780 180M500 310Q370 410 205 475M500 310Q630 410 795 475" fill="none" stroke="#75543b" strokeWidth="42" strokeLinecap="round" opacity=".48" />
          <path d="M500 640V310M500 310Q420 245 220 180M500 310Q580 245 780 180M500 310Q370 410 205 475M500 310Q630 410 795 475" fill="none" stroke="#a37b50" strokeWidth="2" strokeDasharray="2 14" opacity=".5" />
          <g fill="#91734c" opacity=".38"><ellipse cx="98" cy="311" rx="8" ry="4" /><ellipse cx="891" cy="361" rx="12" ry="5" /><ellipse cx="592" cy="173" rx="6" ry="3" /><ellipse cx="389" cy="529" rx="11" ry="4" /></g>
        </svg>
        <div className="farm-world__locations">
          {buildings.map((building) => (
            <button key={building.id} type="button" className={`farm-location farm-location--${building.id}`} data-visual-key={building.visualKey} aria-label={`Inspect ${building.displayName}`} aria-pressed={selectedId === building.id} onClick={() => setSelectedId(building.id)}>
              <LocationArt location={building.id} />
              <span className="farm-location__name" aria-hidden="true">{building.displayName}</span>
            </button>
          ))}
        </div>
        <span className="farm-world__caption">A little room to grow</span>
      </div>
      {selectedBuilding && <BuildingDetails building={selectedBuilding} onClose={closeDetails} />}
    </section>
  )
}
