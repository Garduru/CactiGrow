import type { SkillId } from '../../types/skill'

export interface SkillDefinition {
  id: SkillId
  name: string
  shortName: string
  description: string
}

export const skillDefinitions: readonly SkillDefinition[] = [
  {
    id: 'cultivation',
    name: 'Cultivation',
    shortName: 'Cult.',
    description: 'Planting, growing, collecting, propagation, and Nursery equipment.',
  },
  {
    id: 'breeding',
    name: 'Breeding',
    shortName: 'Breed.',
    description: 'Generations, lineage projects, hybridization, and inheritance.',
  },
  {
    id: 'genetics',
    name: 'Genetics',
    shortName: 'Gen.',
    description: 'Specimen analysis, trait research, mutations, and future genetic techniques.',
  },
]

export function getSkillDefinition(skillId: SkillId): SkillDefinition {
  return skillDefinitions.find(({ id }) => id === skillId)!
}

export interface SkillUnlockDefinition {
  id: string
  skillId: SkillId
  level: number
  name: string
  description: string
}

// Capability definitions can be added here once their design and balance are approved.
export const skillUnlockDefinitions: readonly SkillUnlockDefinition[] = []
