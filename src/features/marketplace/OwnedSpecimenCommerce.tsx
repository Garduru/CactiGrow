import { useState } from 'react'
import { useGameState } from '../../game/useGameState'
import { getSpeciesById } from '../../data/species'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { createPlantVisualDescriptor } from '../plants/plantVisualModel'
import { getNpcSaleValue } from './sellModel'
import { useCommerceActions } from './useCommerceActions'
import { GeneticKnowledgeView } from '../research/GeneticKnowledgeView'
import { projectGeneticKnowledge } from '../research/researchModel'
import { getLevelFromXp } from '../progression/progressionModel'

export function OwnedSpecimenCommerce({ mode, onChanged }: { mode: 'npc' | 'listing'; onChanged?(): void }) {
  const { state } = useGameState()
  const action = useCommerceActions()
  const [selected, setSelected] = useState<string | null>(null)
  const [price, setPrice] = useState('100')
  const [inspect, setInspect] = useState<string | null>(null)
  const askingPrice = Number(price)
  return <section aria-label={mode === 'npc' ? 'Sell specimens to shop' : 'Create a listing'}>
    <p>Choose one mature specimen. Favorited and already-listed specimens cannot be sold.</p>
    {action.message && <p role="status">{action.message}</p>}
    {!state.ownedPlants.length && <p>No collected specimens available.</p>}
    <div className="commerce-grid">{state.ownedPlants.map((plant) => {
      const name = getSpeciesById(plant.speciesId)?.commonName ?? plant.speciesId
      const listed = state.marketplaceListings.some((l) => l.plantId === plant.id && l.status === 'active')
      const protectedPlant = state.gardenOrganization[plant.id]?.favorite
      const value = getNpcSaleValue(plant)
      return <article className="commerce-card" key={plant.id}>
        <PlantVisual visual={createPlantVisualDescriptor(plant)} /><h3>{name}</h3><small>Specimen {plant.id}</small>
        <button type="button" onClick={() => setInspect(inspect === plant.id ? null : plant.id)}>Inspect</button>
        {inspect === plant.id && <GeneticKnowledgeView knowledge={projectGeneticKnowledge(plant, state.geneticsResearch.records[plant.cloneLineId], getLevelFromXp(state.player.skills.genetics.xp))} />}
        {protectedPlant ? <p>Favorited — unprotect in Garden first.</p> : listed ? <p>Already listed.</p> : <>
          {mode === 'npc' && <strong>${value?.toLocaleString() ?? 'Unavailable'}</strong>}
          <button type="button" disabled={!action.ready || action.busy || (mode === 'npc' && value === null)} onClick={() => setSelected(plant.id)}>{mode === 'npc' ? 'Sell specimen' : 'List specimen'}</button>
        </>}
        {selected === plant.id && <div className="commerce-confirm" aria-label="Confirm specimen transaction">
          {mode === 'listing' && <label>Asking price ($)<input type="number" min="1" max="1000000" step="1" value={price} onChange={(e) => setPrice(e.target.value)} /></label>}
          <p>{mode === 'npc' ? `Sell this ${name} permanently for $${value}?` : `List this ${name} for $${askingPrice.toLocaleString()}?`} Specimen {plant.id}.</p>
          <button disabled={action.busy} onClick={() => setSelected(null)}>Cancel</button>
          <button disabled={!action.ready || action.busy || (mode === 'listing' && (!Number.isSafeInteger(askingPrice) || askingPrice < 1 || askingPrice > 1000000))} onClick={async () => {
            const ok = await action.transact(mode === 'npc' ? { type: 'sell-specimen-to-npc', specimenId: plant.id } : { type: 'list-specimen', specimenId: plant.id, askingPrice })
            if (ok) { setSelected(null); onChanged?.() }
          }}>{action.busy ? 'Working…' : mode === 'npc' ? 'Confirm sale' : 'Confirm listing'}</button>
        </div>}
      </article>
    })}</div>
  </section>
}
