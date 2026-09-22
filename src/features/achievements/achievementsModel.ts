import type { AchievementProgress } from '../../types/achievement'
import type { GameplayEventSource } from '../progression/rewardConfig'
import { getLevelFromXp } from '../progression/progressionModel.ts'
import type { PlayerSkills, SkillId } from '../../types/skill'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  requirement:
    | { kind: 'event'; sources: readonly GameplayEventSource[] }
    | { kind: 'skill-level'; skillId: SkillId; level: number }
    | { kind: 'species-count'; count: number }
}

export const achievementDefinitions: readonly AchievementDefinition[] = [
  { id: 'first-planting', name: 'First Planting', description: 'Plant your first seed.', requirement: { kind: 'event', sources: ['plantSeed', 'plantBredSeed'] } },
  { id: 'first-harvest', name: 'First Harvest', description: 'Collect your first mature cactus.', requirement: { kind: 'event', sources: ['collectPlant'] } },
  { id: 'first-breed', name: 'First Breed', description: 'Create your first bred seed.', requirement: { kind: 'event', sources: ['breedPlant'] } },
  { id: 'first-npc-sale', name: 'First NPC Sale', description: 'Sell your first specimen to an NPC.', requirement: { kind: 'event', sources: ['npcSale'] } },
  { id: 'first-market-listing', name: 'First Marketplace Listing', description: 'List your first specimen on the Marketplace.', requirement: { kind: 'event', sources: ['marketplaceListing'] } },
  { id: 'first-species-discovery', name: 'Discover Your First Species', description: 'Record your first cactus species in the Field Journal.', requirement: { kind: 'species-count', count: 1 } },
  ...[10, 25, 50, 75, 99].map((level): AchievementDefinition => ({
    id: `reach-cultivation-level-${level}`,
    name: `Reach Cultivation Level ${level}`,
    description: `Reach Cultivation level ${level}.`,
    requirement: { kind: 'skill-level', skillId: 'cultivation', level },
  })),
]

export type ProgressionEventCounts = Record<GameplayEventSource, number>

export function createAchievementProgress(): AchievementProgress[] {
  return achievementDefinitions.map(({ id }) => ({ id }))
}

export function evaluateAchievements(
  achievements: AchievementProgress[],
  eventCounts: ProgressionEventCounts,
  skills: PlayerSkills,
  discoveredSpeciesCount: number,
  completedAt: string,
): AchievementProgress[] {
  return achievements.map((achievement) => {
    if (achievement.completedAt) return achievement
    const definition = achievementDefinitions.find(({ id }) => id === achievement.id)
    if (!definition) return achievement
    const completed = definition.requirement.kind === 'skill-level'
      ? getLevelFromXp(skills[definition.requirement.skillId].xp) >= definition.requirement.level
      : definition.requirement.kind === 'species-count'
        ? discoveredSpeciesCount >= definition.requirement.count
        : definition.requirement.sources.some((source) => eventCounts[source] > 0)
    return completed ? { ...achievement, completedAt } : achievement
  })
}
