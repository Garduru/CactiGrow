import { useCallback, useState } from 'react'
import type { NurseryPlant } from './nurseryModel'
import { NurserySlot } from './NurserySlot'
import { SeedPicker } from './SeedPicker'
import { useNursery } from './useNursery'

export function NurseryPage() {
  const [plantingSlotId, setPlantingSlotId] = useState<string | null>(null)
  const [collectedPlants, setCollectedPlants] = useState<NurseryPlant[]>([])
  const handleCollected = useCallback((plant: NurseryPlant) => {
    setCollectedPlants((current) => [...current, plant])
  }, [])
  const nursery = useNursery({ onCollect: handleCollected })

  function selectSeed(speciesId: string) {
    if (plantingSlotId && nursery.plantSeed(plantingSlotId, speciesId)) {
      setPlantingSlotId(null)
    }
  }

  const availableSeeds = nursery.seeds.reduce((total, seed) => total + seed.quantity, 0)

  return (
    <section className="nursery" aria-labelledby="nursery-title">
      <div className="nursery__header">
        <div>
          <span className="eyebrow">Greenhouse</span>
          <h1 id="nursery-title">Nursery</h1>
          <p>Plant seeds, watch them grow, and collect mature specimens.</p>
        </div>
        <div className="nursery__summary" aria-label="Nursery summary">
          <span><strong>{nursery.slots.filter((slot) => slot.plant).length}</strong> / 6 growing</span>
          <span><strong>{availableSeeds}</strong> seeds</span>
          <span><strong>{collectedPlants.length}</strong> collected</span>
        </div>
      </div>

      <div className="nursery__notice" role="note">
        Development mode: growth is accelerated so every stage can be previewed.
      </div>

      <div className="nursery__slots">
        {nursery.slots.map((slot, index) => (
          <NurserySlot
            key={slot.id}
            slot={slot}
            slotNumber={index + 1}
            now={nursery.now}
            onPlant={setPlantingSlotId}
            onCollect={nursery.collectPlant}
          />
        ))}
      </div>

      {plantingSlotId && (
        <SeedPicker
          seeds={nursery.seeds}
          onSelect={selectSeed}
          onClose={() => setPlantingSlotId(null)}
        />
      )}
    </section>
  )
}
