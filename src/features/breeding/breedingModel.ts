import type { BredSeed } from '../../types/bredSeed'
import type { PlantGenetics } from '../../types/genetics'
import type { Plant } from '../../types/plant'

export const GENETIC_MIN = 0
export const GENETIC_MAX = 100

const geneticKeys: readonly (keyof PlantGenetics)[] = [
  'vigor', 'growthSpeed', 'size', 'flowering', 'mutationChance',
]

function clampGenetic(value: number): number {
  return Math.round(Math.min(GENETIC_MAX, Math.max(GENETIC_MIN, value)))
}

export function canBreed(parent1: Plant | undefined, parent2: Plant | undefined): boolean {
  return Boolean(parent1 && parent2 && parent1.id !== parent2.id && parent1.stage === 'mature' && parent2.stage === 'mature')
}

export function previewOffspringGenetics(parent1: Plant, parent2: Plant): PlantGenetics {
  return Object.fromEntries(geneticKeys.map((key) => [
    key,
    clampGenetic((parent1.genetics[key] + parent2.genetics[key]) / 2),
  ])) as unknown as PlantGenetics
}

export function inheritGenetics(
  parent1: Plant,
  parent2: Plant,
  random: () => number = Math.random,
): PlantGenetics {
  const baseline = previewOffspringGenetics(parent1, parent2)
  const mutationProbability = baseline.mutationChance / GENETIC_MAX

  return Object.fromEntries(geneticKeys.map((key) => {
    const normalVariation = (random() * 10) - 5
    const mutationVariation = random() < mutationProbability
      ? (random() * 30) - 15
      : 0
    return [key, clampGenetic(baseline[key] + normalVariation + mutationVariation)]
  })) as unknown as PlantGenetics
}

// Cross-species breeding currently follows Parent 1. This isolated rule can be replaced later.
export function resolveOffspringSpecies(parent1: Plant): string {
  return parent1.speciesId
}

export function createBredSeed(
  parent1: Plant,
  parent2: Plant,
  now: number,
  random: () => number = Math.random,
  createId: () => string = () => crypto.randomUUID(),
): BredSeed | null {
  if (!canBreed(parent1, parent2)) return null

  return {
    id: createId(),
    speciesId: resolveOffspringSpecies(parent1),
    createdAt: new Date(now).toISOString(),
    genetics: inheritGenetics(parent1, parent2, random),
    parentPlantIds: [parent1.id, parent2.id],
  }
}

export function hasValidGenetics(genetics: PlantGenetics): boolean {
  return geneticKeys.every((key) => Number.isFinite(genetics[key]) && genetics[key] >= GENETIC_MIN && genetics[key] <= GENETIC_MAX)
}
