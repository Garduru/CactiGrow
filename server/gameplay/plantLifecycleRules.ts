import { getSharedSpeciesById } from '../../shared/gameplay/species.ts'
import type { PlantGeneticsV1 } from '../../shared/api/plantLifecycleV1.ts'

export const GENETIC_ESTABLISHMENT_RULE_VERSION = 1
export const GENETIC_REPRESENTATION_VERSION = 1
export const VISUAL_DERIVATION_VERSION = 1
export const DEVELOPMENT_GROWTH_RULE_VERSION = 1
export const DEVELOPMENT_GROWTH_DURATION_MS = 2 * 60 * 1000

export function establishCommoditySeedGenetics(speciesId: string): PlantGeneticsV1 | null {
  if (!getSharedSpeciesById(speciesId)) return null
  return { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }
}

export function resolveDevelopmentReadyAt(plantedAt: Date, environment: string): Date {
  if (environment !== 'development' && environment !== 'test' && environment !== 'staging') {
    throw new Error('Prototype growth rules are unavailable in production.')
  }
  return new Date(plantedAt.getTime() + DEVELOPMENT_GROWTH_DURATION_MS)
}

// Production uses the existing species catalog rather than the accelerated test clock.
export function resolvePlantGrowth(plantedAt: Date, environment: string, speciesId: string) {
  if (environment !== 'production') return { readyAt: resolveDevelopmentReadyAt(plantedAt, environment), growthRuleVersion: DEVELOPMENT_GROWTH_RULE_VERSION }
  const species = getSharedSpeciesById(speciesId)
  if (!species) throw new Error('Unknown species growth schedule.')
  return { readyAt: new Date(plantedAt.getTime() + species.growthTimeHours * 60 * 60 * 1000), growthRuleVersion: 2 }
}

export type SecureUint16 = () => number
export function rollShiny(randomUint16: SecureUint16): boolean {
  const value = randomUint16()
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error('The random source returned an invalid value.')
  return (value & 0x0fff) === 0
}

export const secureUint16: SecureUint16 = () => crypto.getRandomValues(new Uint16Array(1))[0]
