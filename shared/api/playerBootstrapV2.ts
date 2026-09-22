import { isPlayerBootstrapV1 } from './playerBootstrapV1.ts'

export interface PlayerBootstrapV2 {
  projectionVersion: 2
  player: { playerId: string; createdAt: string }
  grower: {
    profileId: string
    initializedAt: string
    starterGrantedAt: string | null
    tutorialStartedAt: string | null
    tutorialCompletedAt: string | null
    skills: { cultivationXp: number; breedingXp: number; geneticsXp: number }
    tokenBalance: number
    version: number
  }
}

const isDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
const isNullableDate = (value: unknown) => value === null || isDate(value)

export function isPlayerBootstrapV2(value: unknown): value is PlayerBootstrapV2 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).length !== 3 || candidate.projectionVersion !== 2) return false
  if (!isPlayerBootstrapV1({ projectionVersion: 1, player: candidate.player })) return false
  if (!candidate.grower || typeof candidate.grower !== 'object') return false
  const grower = candidate.grower as Record<string, unknown>
  const skills = grower.skills as Record<string, unknown> | undefined
  return Object.keys(grower).length === 8
    && typeof grower.profileId === 'string' && grower.profileId.length > 0
    && isDate(grower.initializedAt)
    && isNullableDate(grower.starterGrantedAt)
    && isNullableDate(grower.tutorialStartedAt)
    && isNullableDate(grower.tutorialCompletedAt)
    && Boolean(skills) && Object.keys(skills!).length === 3
    && ['cultivationXp', 'breedingXp', 'geneticsXp'].every((key) => Number.isSafeInteger(skills![key]) && (skills![key] as number) >= 0)
    && Number.isSafeInteger(grower.tokenBalance) && (grower.tokenBalance as number) >= 0
    && Number.isSafeInteger(grower.version) && (grower.version as number) >= 1
}
