export type SkillId = 'cultivation' | 'breeding' | 'genetics'

export interface SkillProgress {
  xp: number
}

export type PlayerSkills = Record<SkillId, SkillProgress>
