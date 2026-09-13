export const MAX_LEVEL = 99
export const MAX_XP = 13_034_431

function buildXpThresholds(): readonly number[] {
  const thresholds = [0]
  let points = 0

  for (let level = 1; level < MAX_LEVEL; level += 1) {
    points += Math.floor(level + 300 * 2 ** (level / 7))
    thresholds.push(Math.floor(points / 4))
  }

  return thresholds
}

export const XP_THRESHOLDS = buildXpThresholds()

export interface ProgressionSnapshot {
  totalXp: number
  level: number
  levelStartXp: number
  nextLevelXp: number
  progressXp: number
  requiredXp: number
  remainingXp: number
  isMaxLevel: boolean
}

export function clampXp(xp: number): number {
  if (!Number.isFinite(xp)) return 0
  return Math.min(MAX_XP, Math.max(0, Math.trunc(xp)))
}

export function getLevelFromXp(xp: number): number {
  const safeXp = clampXp(xp)
  for (let level = MAX_LEVEL; level >= 1; level -= 1) {
    if (safeXp >= XP_THRESHOLDS[level - 1]) return level
  }
  return 1
}

export function getProgressionSnapshot(xp: number): ProgressionSnapshot {
  const totalXp = clampXp(xp)
  const level = getLevelFromXp(totalXp)
  const isMaxLevel = level === MAX_LEVEL
  const levelStartXp = XP_THRESHOLDS[level - 1]
  const nextLevelXp = isMaxLevel ? MAX_XP : XP_THRESHOLDS[level]
  const requiredXp = isMaxLevel ? 0 : nextLevelXp - levelStartXp
  const progressXp = isMaxLevel ? 0 : totalXp - levelStartXp

  return {
    totalXp,
    level,
    levelStartXp,
    nextLevelXp,
    progressXp,
    requiredXp,
    remainingXp: isMaxLevel ? 0 : nextLevelXp - totalXp,
    isMaxLevel,
  }
}

export function addXp(currentXp: number, amount: number): number | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null
  const safeCurrentXp = clampXp(currentXp)
  return clampXp(safeCurrentXp + Math.min(amount, Number.MAX_SAFE_INTEGER - safeCurrentXp))
}

export function awardSkillXp(
  skills: PlayerSkills,
  skillId: SkillId,
  amount: number,
): PlayerSkills | null {
  const nextXp = addXp(skills[skillId].xp, amount)
  if (nextXp === null) return null
  return { ...skills, [skillId]: { xp: nextXp } }
}
import type { PlayerSkills, SkillId } from '../../types/skill'
