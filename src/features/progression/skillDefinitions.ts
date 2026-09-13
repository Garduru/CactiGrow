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
  implemented: boolean
}

export const skillUnlockDefinitions: readonly SkillUnlockDefinition[] = [
  { id: 'genetics-observation', skillId: 'genetics', level: 1, name: 'Basic Observation', description: 'Record visible facts about an owned clone line.', implemented: true },
  { id: 'genetics-specimen-comparison', skillId: 'genetics', level: 5, name: 'Specimen Comparison', description: 'Compare two owned clone lines without claiming verification.', implemented: true },
  { id: 'genetics-basic-analysis', skillId: 'genetics', level: 10, name: 'Basic Genetic Analysis', description: 'Classify known visible genetic features.', implemented: true },
  { id: 'genetics-stability-insight', skillId: 'genetics', level: 15, name: 'Basic Stability Insight', description: 'See coarse stability for known visible features.', implemented: true },
  { id: 'genetics-inheritance-estimates', skillId: 'genetics', level: 20, name: 'Inheritance Estimates', description: 'See CactiGrow breeding estimate categories.', implemented: true },
  { id: 'genetics-quantitative-analysis', skillId: 'genetics', level: 25, name: 'Improved Quantitative Analysis', description: 'Interpret quantitative genetic values more precisely.', implemented: true },
  { id: 'genetics-carrier-detection', skillId: 'genetics', level: 30, name: 'Hidden Carrier Detection', description: 'Reveal non-expressed carrier states after inheritance analysis.', implemented: true },
  { id: 'genetics-advanced-analysis', skillId: 'genetics', level: 35, name: 'Advanced Inheritance / Stability', description: 'Advance confidence in inheritance and stability research.', implemented: true },
  { id: 'genetics-tissue-sampling', skillId: 'genetics', level: 40, name: 'Tissue Sampling', description: 'Future laboratory capability.', implemented: false },
  { id: 'genetics-clone-comparison', skillId: 'genetics', level: 45, name: 'Basic Clone Comparison', description: 'Future clone comparison capability.', implemented: false },
  { id: 'genetics-quantitative-extraction', skillId: 'genetics', level: 50, name: 'Quantitative Extraction', description: 'Future extraction capability.', implemented: false },
  { id: 'genetics-improved-extraction', skillId: 'genetics', level: 55, name: 'Improved Extraction / Mutation Analysis', description: 'Future laboratory capability.', implemented: false },
  { id: 'genetics-mutation-extraction', skillId: 'genetics', level: 60, name: 'Mutation-Associated Extraction', description: 'Future extraction capability.', implemented: false },
  { id: 'genetics-clone-verification', skillId: 'genetics', level: 65, name: 'Advanced Clone Verification', description: 'Future authoritative verification capability.', implemented: false },
  { id: 'genetics-extraction-quality', skillId: 'genetics', level: 70, name: 'Improved Extraction Quality', description: 'Future laboratory capability.', implemented: false },
  { id: 'genetics-complex-stacks', skillId: 'genetics', level: 75, name: 'Complex Stack Analysis', description: 'Future advanced analysis capability.', implemented: false },
  { id: 'genetics-seed-analysis', skillId: 'genetics', level: 80, name: 'Advanced Seed Genetics', description: 'Future seed analysis capability.', implemented: false },
  { id: 'genetics-trait-isolation', skillId: 'genetics', level: 85, name: 'Targeted Trait Isolation', description: 'Future laboratory capability.', implemented: false },
  { id: 'genetics-mutation-isolation', skillId: 'genetics', level: 90, name: 'Advanced Mutation Isolation', description: 'Future laboratory capability.', implemented: false },
  { id: 'genetics-master-analysis', skillId: 'genetics', level: 95, name: 'Master Analysis', description: 'Future master research capability.', implemented: false },
  { id: 'genetics-mastery', skillId: 'genetics', level: 99, name: 'Genetics Mastery', description: 'Fully characterize researched clone lines.', implemented: true },
]

export function getSkillUnlocks(skillId: SkillId): readonly SkillUnlockDefinition[] {
  return skillUnlockDefinitions.filter((unlock) => unlock.skillId === skillId)
}
