import type { NurseryGrowth } from './nurseryModel'
import { visualStageFromProgress } from '../plants/plantVisualModel'
import type { VisualGrowthStage } from '../../types/plantVisual'

export type NurseryPresentationStage = 'germinating' | VisualGrowthStage

export function getNurseryPresentationStage(growth: NurseryGrowth): NurseryPresentationStage {
  if (!growth.isMature && growth.progress < .15) return 'germinating'
  return visualStageFromProgress(growth.progress, growth.isMature)
}

export function formatGrowthTimeRemaining(plantedAt: string, now: number, durationMs: number): string {
  const remainingMs = Math.max(0, durationMs - Math.max(0, now - Date.parse(plantedAt)))
  if (remainingMs === 0) return 'Ready to collect'
  const seconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes ? `${minutes}m ${remainingSeconds}s remaining` : `${remainingSeconds}s remaining`
}
