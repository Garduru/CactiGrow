import { useEffect, useState } from 'react'
import { getTotalSeedQuantity } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { NurserySlot } from './NurserySlot'
import { SeedPicker } from './SeedPicker'
import { getNurseryCapacity } from '../property/propertyModel'
import { getNurseryLevelDefinition } from '../property/propertyConfig'
import { Badge } from '../../components/ui/Badge'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import type { PlantSpecimenV2 } from '../../../shared/api/plantLifecycleV2'
import type { NurserySlotState } from './nurseryModel'
import type { InventoryItem } from '../../types/inventory'

function serverPlant(specimen: PlantSpecimenV2) {
  return { id: specimen.specimenId, ownerId: 'server-player', speciesId: specimen.speciesId, cloneLineId: specimen.cloneLineId, stage: 'seed' as const, plantedAt: specimen.plantedAt, lastUpdatedAt: specimen.collectedAt ?? specimen.plantedAt, genetics: specimen.genetics, geneticFeatures: specimen.geneticFeatures, specialVariants: specimen.specialVariants, parentPlantIds: specimen.parentPlantIds ?? undefined, parentSpeciesIds: specimen.parentSpeciesIds ?? undefined, isHybrid: specimen.isHybrid, isHarvestable: false, isListedForSale: false }
}

function ServerNurseryPage() {
  const { state, plant, plantBredSeed, collect } = usePlantLifecycle()
  const [plantingSlotId, setPlantingSlotId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  if (state.authority !== 'server' || state.status === 'loading') return <section className="nursery"><LocationHeader titleId="nursery-title" eyebrow="Greenhouse" title="Nursery" subtitle="Loading the Nursery…" /></section>
  if (state.status === 'error') return <section className="nursery"><LocationHeader titleId="nursery-title" eyebrow="Greenhouse" title="Nursery" subtitle="Unable to load the Nursery. Please try again." /></section>
  const capacity = state.projection.nursery.capacity
  const slots: NurserySlotState[] = state.projection.nursery.slots.slice(0, capacity).map((slot) => ({ id: slot.slotId, plant: slot.occupancy ? serverPlant(slot.occupancy.specimen) : null }))
  const seeds: InventoryItem[] = state.projection.seedStacks.map((stack) => ({ id: `server-seed-${stack.speciesId}`, itemType: 'seed', itemKey: stack.speciesId, quantity: stack.quantity }))
  const benchSize = Math.ceil(capacity / 2)
  return (
    <section className="nursery" aria-labelledby="nursery-title">
      <LocationHeader titleId="nursery-title" eyebrow="Greenhouse" title="Nursery" subtitle="Plant seeds and raise young cacti for the Garden." status={
        <>
          <Badge tone="accent">Lv. {capacity === 8 ? 2 : 1}</Badge>
          <Badge tone="success">{slots.filter((slot) => slot.plant).length} / {capacity} growing</Badge>
        </>
      } />
      <div className={`nursery-greenhouse${capacity === 8 ? ' nursery-greenhouse--expanded' : ''}`}>
        <div className="nursery-benches">
          {[slots.slice(0, benchSize), slots.slice(benchSize)].map((bench, index) => (
            <section className="nursery-bench" aria-label={`Growing bench ${index + 1}`} key={index}>
              <span className="nursery-bench__label">Bench {String.fromCharCode(65 + index)}</span>
              <div className="nursery-bench__positions">
                {bench.map((slot, offset) => {
                  const persisted = state.projection.nursery.slots.find((item) => item.slotId === slot.id)
                  const duration = persisted?.occupancy ? Date.parse(persisted.occupancy.readyAt) - Date.parse(persisted.occupancy.plantedAt) : undefined
                  return (
                    <NurserySlot
                      key={slot.id}
                      slot={slot}
                      slotNumber={index * benchSize + offset + 1}
                      now={now}
                      growthDurationMs={duration}
                      onPlant={setPlantingSlotId}
                      onCollect={collect}
                    />
                  )
                })}
              </div>
              <span className="nursery-bench__front" aria-hidden="true" />
            </section>
          ))}
        </div>
        <div className="nursery-greenhouse__status">
          <span><strong>{seeds.reduce((sum, item) => sum + item.quantity, 0) + state.projection.bredSeeds.length}</strong> seeds ready</span>
          <span><strong>{state.projection.ownedSpecimens.length}</strong> collected</span>
        </div>
      </div>
      {plantingSlotId && (
        <SeedPicker
          seeds={seeds}
          bredSeeds={state.projection.bredSeeds}
          onSelect={async (speciesId) => { await plant(plantingSlotId, speciesId).then((ok) => { if (ok) setPlantingSlotId(null) }) }}
          onSelectBredSeed={async (seedId) => { await plantBredSeed(plantingSlotId, seedId).then((ok) => { if (ok) setPlantingSlotId(null) }) }}
          onClose={() => setPlantingSlotId(null)}
        />
      )}
    </section>
  )
}

export function NurseryPage() {
  const lifecycle = usePlantLifecycle()
  if (lifecycle.state.authority === 'server') return <ServerNurseryPage />
  return <LocalNurseryPage />
}

function LocalNurseryPage() {
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
      <LocationHeader titleId="nursery-title" eyebrow="Greenhouse" title="Nursery" subtitle="Plant seeds and raise young cacti for the Garden." status={
        <>
          <Badge tone="accent">Lv. {nurseryLevel} · {nurseryDefinition.name}</Badge>
          <Badge tone={occupied === capacity ? 'warning' : 'success'}>{occupied} / {capacity} growing</Badge>
        </>
      } />

      <div className={`nursery-greenhouse${nurseryLevel >= 2 ? ' nursery-greenhouse--expanded' : ''}`}>
        <div className="nursery-greenhouse__outside" aria-hidden="true"><span /><span /><span /></div>
        <div className="nursery-greenhouse__frame" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="nursery-greenhouse__light" aria-hidden="true" />
        <div className="nursery-greenhouse__tools" aria-hidden="true"><span className="nursery-greenhouse__can" /><span className="nursery-greenhouse__soil" /></div>
        <div className="nursery-benches">
          {benches.map((bench, benchIndex) => (
            <section className="nursery-bench" aria-label={`Growing bench ${benchIndex + 1}`} key={benchIndex}>
              <span className="nursery-bench__label">Bench {String.fromCharCode(65 + benchIndex)}{nurseryLevel >= 2 && benchIndex === 1 ? ' · Expanded' : ''}</span>
              <div className="nursery-bench__positions">
                {bench.map((slot) => {
                  const slotIndex = state.nurserySlots.indexOf(slot)
                  return (
                    <NurserySlot
                      key={slot.id}
                      slot={slot}
                      slotNumber={slotIndex + 1}
                      now={now}
                      onPlant={setPlantingSlotId}
                      onCollect={collectPlant}
                    />
                  )
                })}
              </div>
              <span className="nursery-bench__front" aria-hidden="true" />
            </section>
          ))}
        </div>
        <div className="nursery-greenhouse__status" aria-label="Nursery summary">
          <span><strong>{availableSeeds}</strong> seeds ready</span>
          <span><strong>{state.ownedPlants.length}</strong> in Garden</span>
        </div>
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
