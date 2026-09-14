import type { GeneticsLabTierId } from '../../types/lab'

export interface GeneticsLabTierDefinition {
  id: GeneticsLabTierId
  name: string
  cost: number
  capabilities: readonly string[]
}

export const geneticsLabTiers: readonly GeneticsLabTierDefinition[] = [
  { id: 0, name: 'No Lab', cost: 0, capabilities: ['Existing observation and research'] },
  { id: 1, name: 'Research Bench', cost: 250, capabilities: ['Organized genetics study'] },
  { id: 2, name: 'Microscope Station', cost: 750, capabilities: ['Tissue sample preparation'] },
  { id: 3, name: 'Genetics Lab', cost: 2500, capabilities: ['Quantitative extraction'] },
  { id: 4, name: 'Advanced Genetics Lab', cost: 7500, capabilities: ['Future advanced mutation work'] },
  { id: 5, name: 'Research Facility', cost: 20000, capabilities: ['Future mastery systems'] },
]

export const TISSUE_SAMPLING_LEVEL = 40
export const TISSUE_SAMPLING_LAB_TIER: GeneticsLabTierId = 2
export const TISSUE_SAMPLING_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function getLabTierDefinition(tier: GeneticsLabTierId): GeneticsLabTierDefinition {
  return geneticsLabTiers.find((definition) => definition.id === tier)!
}

export const labWorldVisualKeys: Record<GeneticsLabTierId, string> = { 0: 'lab-site', 1: 'lab-research-bench', 2: 'lab-microscope', 3: 'lab-genetics', 4: 'lab-advanced', 5: 'lab-research-facility' }
