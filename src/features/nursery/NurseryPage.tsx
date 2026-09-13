import { useEffect, useState } from 'react'
import { getTotalSeedQuantity } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { NurserySlot } from './NurserySlot'
import { SeedPicker } from './SeedPicker'

export function NurseryPage() {
  const [plantingSlotId, setPlantingSlotId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { state, plantSeed, plantBredSeed, collectPlant } = useGameState()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function selectSeed(speciesId: string) {
    if (plantingSlotId && plantSeed(plantingSlotId, speciesId)) {
      setPlantingSlotId(null)
    }
  }

  function selectBredSeed(seedId: string) {
    if (plantingSlotId && plantBredSeed(plantingSlotId, seedId)) setPlantingSlotId(null)
  }

  const seeds = state.inventory.filter((item) => item.itemType === 'seed')
  const availableSeeds = getTotalSeedQuantity(state)

  return (
    <section className="nursery" aria-labelledby="nursery-title">
      <div className="nursery__header">
        <div>
          <span className="eyebrow">Greenhouse</span>
          <h1 id="nursery-title">Nursery</h1>
          <p>Plant seeds, watch them grow, and collect mature specimens.</p>
        </div>
        <div className="nursery__summary" aria-label="Nursery summary">
          <span><strong>{state.nurserySlots.filter((slot) => slot.plant).length}</strong> / 6 growing</span>
          <span><strong>{availableSeeds}</strong> seeds</span>
          <span><strong>{state.ownedPlants.length}</strong> collected</span>
        </div>
      </div>

      <div className="nursery__notice" role="note">
        Development mode: growth is accelerated so every stage can be previewed.
      </div>

      <div className="nursery__slots">
        {state.nurserySlots.map((slot, index) => (
          <NurserySlot
            key={slot.id}
            slot={slot}
            slotNumber={index + 1}
            now={now}
            onPlant={setPlantingSlotId}
            onCollect={collectPlant}
          />
        ))}
      </div>

      {plantingSlotId && (
        <SeedPicker
          seeds={seeds}
          bredSeeds={state.bredSeeds}
          onSelect={selectSeed}
          onSelectBredSeed={selectBredSeed}
          onClose={() => setPlantingSlotId(null)}
        />
      )}
    </section>
  )
}
