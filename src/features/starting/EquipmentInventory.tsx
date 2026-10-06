import { useStartingExperience } from './StartingContext'
import { getLevelFromXp } from '../progression/progressionModel'
export function EquipmentInventory() {
  const tutorial = useStartingExperience(), state = tutorial.state
  if (!tutorial.active || !state) return null
  return <section className="equipment-inventory" aria-label="Equipment"><h2>Equipment</h2><p>Tool: <strong>{state.equipment.tool ? 'Field Knife' : 'Empty'}</strong></p>
    {state.ownedEquipment.includes('field-knife') && <button disabled={tutorial.pending} onClick={() => { void tutorial.execute({ type: 'equip-tool', itemId: state.equipment.tool ? null : 'field-knife' }) }}>{state.equipment.tool ? 'Unequip Field Knife' : 'Equip Field Knife'}</button>}
    {!state.ownedEquipment.length && <p>{state.compatibilityComplete ? 'No harvesting tool owned.' : 'Mara at Starting Spawn has your first harvesting tool.'}</p>}
    <p>Harvesting · Level {getLevelFromXp(state.harvestingXp)} · {state.harvestingXp} XP</p>
    {state.tutorialSeedAvailable && <p>San Pedro tutorial seed × 1 · Reserved for the Path 1 pot</p>}
    {state.offspringSeedId && <p>Practice offspring · {state.offspringSeedId} · Demonstration seed</p>}
    {tutorial.error && <p role="alert">{tutorial.error}</p>}
  </section>
}
