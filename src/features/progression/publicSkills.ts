import { skillDefinitions } from './skillDefinitions.ts'
import { getLevelFromXp } from './progressionModel.ts'
import type { PlayerSkills, SkillId } from '../../types/skill.ts'

export interface PublicSkillLevel { id: SkillId; name: string; level: number }
/** Maps the existing persisted skill XP columns at the projection boundary. */
export function publicSkillsFromXp(skills: Record<`${SkillId}Xp`, number>): PublicSkillLevel[] {
  return skillDefinitions.map(({ id, name }) => ({ id, name, level: getLevelFromXp(skills[`${id}Xp`]) }))
}
export function publicSkillsFromPlayer(skills: PlayerSkills): PublicSkillLevel[] {
  return skillDefinitions.map(({ id, name }) => ({ id, name, level: getLevelFromXp(skills[id].xp) }))
}
export function getTotalLevel(skills: readonly { level: number }[]): number {
  return skills.reduce((total, skill) => total + skill.level, 0)
}
