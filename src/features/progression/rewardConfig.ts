import type { SkillId } from '../../types/skill'

export type GameplayEventSource =
  | 'plantSeed'
  | 'plantBredSeed'
  | 'collectPlant'
  | 'breedPlant'
  | 'npcSale'
  | 'marketplaceListing'

export interface SkillXpReward {
  skillId: SkillId
  amount: number
}

export const SKILL_XP_REWARDS: Partial<Record<GameplayEventSource, SkillXpReward>> = {
  plantSeed: { skillId: 'cultivation', amount: 10 },
  plantBredSeed: { skillId: 'cultivation', amount: 15 },
  collectPlant: { skillId: 'cultivation', amount: 25 },
  breedPlant: { skillId: 'breeding', amount: 40 },
}
