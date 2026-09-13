import type { AchievementProgress } from '../../types/achievement'
import type { XpRewardSource } from '../progression/rewardConfig'
import { getLevelFromXp } from '../progression/progressionModel'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  requirement: { kind: 'event'; sources: readonly XpRewardSource[] } | { kind: 'level'; level: number }
}

export const achievementDefinitions: readonly AchievementDefinition[] = [
  { id: 'first-planting', name: 'First Planting', description: 'Plant your first seed.', requirement: { kind: 'event', sources: ['plantSeed', 'plantBredSeed'] } },
  { id: 'first-harvest', name: 'First Harvest', description: 'Collect your first mature cactus.', requirement: { kind: 'event', sources: ['collectPlant'] } },
  { id: 'first-breed', name: 'First Breed', description: 'Create your first bred seed.', requirement: { kind: 'event', sources: ['breedPlant'] } },
  { id: 'first-npc-sale', name: 'First NPC Sale', description: 'Sell your first specimen to an NPC.', requirement: { kind: 'event', sources: ['npcSale'] } },
  { id: 'first-market-listing', name: 'First Marketplace Listing', description: 'List your first specimen on the Marketplace.', requirement: { kind: 'event', sources: ['marketplaceListing'] } },
  ...[10, 25, 50, 75, 99].map((level): AchievementDefinition => ({
    id: `reach-level-${level}`,
    name: `Reach Level ${level}`,
    description: `Reach CactiGrow level ${level}.`,
    requirement: { kind: 'level', level },
  })),
]

export type ProgressionEventCounts = Record<XpRewardSource, number>

export function createAchievementProgress(): AchievementProgress[] {
  return achievementDefinitions.map(({ id }) => ({ id }))
}

export function evaluateAchievements(
  achievements: AchievementProgress[],
  eventCounts: ProgressionEventCounts,
  totalXp: number,
  completedAt: string,
): AchievementProgress[] {
  const level = getLevelFromXp(totalXp)
  return achievements.map((achievement) => {
    if (achievement.completedAt) return achievement
    const definition = achievementDefinitions.find(({ id }) => id === achievement.id)
    if (!definition) return achievement
    const completed = definition.requirement.kind === 'level'
      ? level >= definition.requirement.level
      : definition.requirement.sources.some((source) => eventCounts[source] > 0)
    return completed ? { ...achievement, completedAt } : achievement
  })
}
