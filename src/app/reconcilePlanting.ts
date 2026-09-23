import type { PlantBredSeedResultV3, PlantCommoditySeedResultV3, PlantLifecycleProjectionV3 } from '../../shared/api/plantLifecycleV3.ts'

/** Apply only fields acknowledged by the authoritative planting response. */
export function reconcilePlanting(projection: PlantLifecycleProjectionV3, result: PlantBredSeedResultV3 | PlantCommoditySeedResultV3): PlantLifecycleProjectionV3 {
  return {
    ...projection,
    lifecycleVersion: result.lifecycleVersion,
    nursery: { ...projection.nursery, slots: projection.nursery.slots.map((slot) => slot.slotId === result.slot.slotId ? result.slot : slot) },
    seedStacks: 'seedStack' in result ? projection.seedStacks.map((stack) => stack.speciesId === result.seedStack.speciesId ? result.seedStack : stack) : projection.seedStacks,
    bredSeeds: 'seedId' in result ? projection.bredSeeds.filter((seed) => seed.seedId !== result.seedId) : projection.bredSeeds,
  }
}
