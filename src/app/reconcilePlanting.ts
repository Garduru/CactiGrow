import type { PlantBredSeedResultV3, PlantCommoditySeedResultV3, PlantLifecycleProjectionV3 } from '../../shared/api/plantLifecycleV3.ts'

/** Apply only fields acknowledged by the authoritative planting response. */
export function reconcilePlanting(projection: PlantLifecycleProjectionV3, result: PlantBredSeedResultV3 | PlantCommoditySeedResultV3): PlantLifecycleProjectionV3 {
  return {
    ...projection,
    lifecycleVersion: result.lifecycleVersion,
    nursery: { ...projection.nursery, slots: projection.nursery.slots.map((slot) => slot.slotId === result.slot.slotId ? result.slot : slot) },
    seedStacks: 'seedStack' in result ? projection.seedStacks.map((stack) => stack.speciesId === result.seedStack.speciesId ? result.seedStack : stack) : projection.seedStacks,
    ...(projection.wildSeedLots ? { wildSeedLots: projection.wildSeedLots.map(lot => 'seedId' in result && lot.seedIds.includes(result.seedId) ? { ...lot, seedIds: lot.seedIds.filter(id => id !== result.seedId), quantity: lot.quantity - 1 } : lot).filter(lot => lot.quantity > 0) } : {}),
    bredSeeds: 'seedId' in result ? projection.bredSeeds.filter((seed) => seed.seedId !== result.seedId) : projection.bredSeeds,
  }
}
