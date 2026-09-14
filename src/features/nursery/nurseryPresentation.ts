import type { Species } from '../../types/species'

export type NurseryPlantSilhouette = 'columnar' | 'button' | 'generic'
export type NurseryVisualPhase = 'early' | 'mid' | 'late' | 'mature'

const silhouetteByImageKey: Readonly<Record<string, NurseryPlantSilhouette>> = {
  'echinopsis-pachanoi': 'columnar',
  'lophophora-williamsii': 'button',
}

export function getNurseryPlantSilhouette(species?: Species): NurseryPlantSilhouette {
  return species ? silhouetteByImageKey[species.imageKey] ?? 'generic' : 'generic'
}

export function getNurseryVisualPhase(progress: number): NurseryVisualPhase {
  if (progress >= 1) return 'mature'
  if (progress >= .67) return 'late'
  if (progress >= .34) return 'mid'
  return 'early'
}

export function formatGrowthTimeRemaining(plantedAt: string, now: number, durationMs: number): string {
  const remainingMs = Math.max(0, durationMs - Math.max(0, now - Date.parse(plantedAt)))
  if (remainingMs === 0) return 'Ready to collect'
  const seconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes ? `${minutes}m ${remainingSeconds}s remaining` : `${remainingSeconds}s remaining`
}
