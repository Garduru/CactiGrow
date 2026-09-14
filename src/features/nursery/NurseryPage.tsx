import { useEffect, useState } from 'react'
import { getTotalSeedQuantity } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { NurserySlot } from './NurserySlot'
import { SeedPicker } from './SeedPicker'
import { getNurseryCapacity } from '../property/propertyModel'
import { getNurseryLevelDefinition } from '../property/propertyConfig'
import { Badge } from '../../components/ui/Badge'
import { LocationHeader } from '../../components/ui/LocationHeader'

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
  const nurseryLevel = state.property.buildings.nursery.level
  const nurseryDefinition = getNurseryLevelDefinition(nurseryLevel)
  const capacity = getNurseryCapacity(state.property)
  const occupied = state.nurserySlots.filter((slot) => slot.plant).length
  const benchSize = Math.ceil(state.nurserySlots.length / 2)
  const benches = [state.nurserySlots.slice(0, benchSize), state.nurserySlots.slice(benchSize)]

  return (
    <section className="nursery" aria-labelledby="nursery-title">
      <LocationHeader titleId="nursery-title" eyebrow="Greenhouse" title="Nursery" subtitle="Plant seeds and raise young cacti for the Garden." status={<><Badge tone="accent">Lv. {nurseryLevel} · {nurseryDefinition.name}</Badge><Badge tone={occupied === capacity ? 'warning' : 'success'}>{occupied} / {capacity} growing</Badge></>} />

      <div className={`nursery-greenhouse${nurseryLevel >= 2 ? ' nursery-greenhouse--expanded' : ''}`}>
        <div className="nursery-greenhouse__outside" aria-hidden="true"><span /><span /><span /></div>
        <div className="nursery-greenhouse__frame" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="nursery-greenhouse__light" aria-hidden="true" />
        <div className="nursery-greenhouse__tools" aria-hidden="true"><span className="nursery-greenhouse__can" /><span className="nursery-greenhouse__soil" /></div>
        <div className="nursery-benches">
          {benches.map((bench, benchIndex) => <section className="nursery-bench" aria-label={`Growing bench ${benchIndex + 1}`} key={benchIndex}>
            <span className="nursery-bench__label">Bench {String.fromCharCode(65 + benchIndex)}{nurseryLevel >= 2 && benchIndex === 1 ? ' · Expanded' : ''}</span>
            <div className="nursery-bench__positions">
              {bench.map((slot) => {
                const slotIndex = state.nurserySlots.indexOf(slot)
                return <NurserySlot key={slot.id} slot={slot} slotNumber={slotIndex + 1} now={now} onPlant={setPlantingSlotId} onCollect={collectPlant} />
              })}
            </div>
            <span className="nursery-bench__front" aria-hidden="true" />
          </section>)}
        </div>
        <div className="nursery-greenhouse__status" aria-label="Nursery summary"><span><strong>{availableSeeds}</strong> seeds ready</span><span><strong>{state.ownedPlants.length}</strong> in Garden</span></div>
      </div>

      <p className="nursery__notice" role="note">Development preview: growth is accelerated to show every stage.</p>

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
