import { GARDEN_DISPLAY_SLOT_IDS, type GardenDisplayAssignments, type GardenDisplaySlotId } from '../../types/garden'
import { gardenDisplayLabels } from './gardenDisplayModel'

export function GardenDisplayControls({ plantId, assignments, onAssign, onClear }: {
  plantId: string
  assignments: GardenDisplayAssignments
  onAssign: (slotId: GardenDisplaySlotId) => void
  onClear: (slotId: GardenDisplaySlotId) => void
}) {
  const currentSlot = GARDEN_DISPLAY_SLOT_IDS.find((id) => assignments[id] === plantId)
  return <section className="plant-details__section garden-display-controls" aria-label="Garden display">
    <h3>Garden display</h3>
    <p>{currentSlot ? `Displayed in ${gardenDisplayLabels[currentSlot]}.` : 'Choose one empty bed to display this specimen. Your collection stays unchanged.'}</p>
    {currentSlot ? <button type="button" onClick={() => onClear(currentSlot)}>Remove from display</button> : <div className="garden-display-controls__choices">{GARDEN_DISPLAY_SLOT_IDS.map((id) => <button key={id} type="button" disabled={assignments[id] !== null} onClick={() => onAssign(id)}>{gardenDisplayLabels[id]}{assignments[id] ? ' · occupied' : ''}</button>)}</div>}
  </section>
}
