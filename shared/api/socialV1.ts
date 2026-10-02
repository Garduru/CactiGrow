import { getTotalLevel, type PublicSkillLevel } from '../../src/features/progression/publicSkills.ts'
import { skillDefinitions } from '../../src/features/progression/skillDefinitions.ts'
import { isCanonicalUuid } from '../realtime/identifiers.ts'
import { hasExactKeys, isRecord } from '../realtime/protocolV1.ts'

export interface PublicPlayerSummaryV1 {
  publicId: string
  displayName: string
  joinedAt: string
  skills?: readonly PublicSkillLevel[]
  totalLevel?: number
  cultivationLevel?: number
  cultivationXp?: number
  collectionCount: number
  breedingCount: number
}

export interface SocialOverviewV1 {
  projectionVersion: 1
  ownProfile: PublicPlayerSummaryV1 | null
  friends: readonly PublicPlayerSummaryV1[]
  incomingRequests: readonly PublicPlayerSummaryV1[]
  outgoingRequests: readonly PublicPlayerSummaryV1[]
  blockedPlayers: readonly PublicPlayerSummaryV1[]
}

export interface PublicPlayerProfileV1 {
  projectionVersion: 1
  profile: PublicPlayerSummaryV1
  relationship: {
    isSelf: boolean
    areFriends: boolean
    request: 'incoming' | 'outgoing' | null
    blockedByMe: boolean
    blocksMe: boolean
  }
}

export type SocialCommandV1 =
  | { type: 'set-display-name'; displayName: string }
  | { type: 'add-friend'; publicId: string }
  | { type: 'accept-friend'; publicId: string }
  | { type: 'decline-friend'; publicId: string }
  | { type: 'remove-friend'; publicId: string }
  | { type: 'block-player'; publicId: string }
  | { type: 'unblock-player'; publicId: string }

export function isSocialCommandV1(value: unknown): value is SocialCommandV1 {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (value.type === 'set-display-name') return hasExactKeys(value, ['type', 'displayName'])
    && typeof value.displayName === 'string' && value.displayName.length <= 100
  if (!['add-friend', 'accept-friend', 'decline-friend', 'remove-friend', 'block-player', 'unblock-player'].includes(value.type)) return false
  return hasExactKeys(value, ['type', 'publicId']) && isCanonicalUuid(value.publicId)
}

function isSummary(value: unknown): value is PublicPlayerSummaryV1 {
  const baseKeys = ['publicId', 'displayName', 'joinedAt', 'collectionCount', 'breedingCount']
  if (!isRecord(value) || (!hasExactKeys(value, baseKeys)
    && !hasExactKeys(value, [...baseKeys, 'cultivationLevel', 'cultivationXp'])
    && !hasExactKeys(value, [...baseKeys, 'cultivationLevel', 'cultivationXp', 'skills', 'totalLevel']))) return false
  return isCanonicalUuid(value.publicId) && typeof value.displayName === 'string' && value.displayName.length >= 3 && value.displayName.length <= 20
    && typeof value.joinedAt === 'string' && Number.isFinite(Date.parse(value.joinedAt))
    && Number.isSafeInteger(value.collectionCount) && (value.collectionCount as number) >= 0
    && Number.isSafeInteger(value.breedingCount) && (value.breedingCount as number) >= 0
    && (!Object.hasOwn(value, 'cultivationLevel') || (Number.isSafeInteger(value.cultivationLevel) && (value.cultivationLevel as number) >= 1 && (value.cultivationLevel as number) <= 99))
    && (!Object.hasOwn(value, 'skills') || (isPublicSkills(value.skills) && value.totalLevel === getTotalLevel(value.skills)))
    && (!Object.hasOwn(value, 'cultivationXp') || (Number.isSafeInteger(value.cultivationXp) && (value.cultivationXp as number) >= 0))
}

export function isSocialOverviewV1(value: unknown): value is SocialOverviewV1 {
  return isRecord(value) && hasExactKeys(value, ['projectionVersion', 'ownProfile', 'friends', 'incomingRequests', 'outgoingRequests', 'blockedPlayers'])
    && value.projectionVersion === 1 && (value.ownProfile === null || isSummary(value.ownProfile))
    && Array.isArray(value.friends) && value.friends.every(isSummary)
    && Array.isArray(value.incomingRequests) && value.incomingRequests.every(isSummary)
    && Array.isArray(value.outgoingRequests) && value.outgoingRequests.every(isSummary)
    && Array.isArray(value.blockedPlayers) && value.blockedPlayers.every(isSummary)
}

export function isPublicPlayerProfileV1(value: unknown): value is PublicPlayerProfileV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['projectionVersion', 'profile', 'relationship']) || value.projectionVersion !== 1 || !isSummary(value.profile)) return false
  const relationship = value.relationship
  return isRecord(relationship) && hasExactKeys(relationship, ['isSelf', 'areFriends', 'request', 'blockedByMe', 'blocksMe'])
    && typeof relationship.isSelf === 'boolean' && typeof relationship.areFriends === 'boolean'
    && (relationship.request === null || relationship.request === 'incoming' || relationship.request === 'outgoing')
    && typeof relationship.blockedByMe === 'boolean' && typeof relationship.blocksMe === 'boolean'
}
function isPublicSkills(value: unknown): value is PublicSkillLevel[] {
  return Array.isArray(value) && value.length === skillDefinitions.length && skillDefinitions.every((definition) =>
    value.filter((skill) => isRecord(skill) && hasExactKeys(skill, ['id', 'name', 'level']) && skill.id === definition.id
      && skill.name === definition.name && typeof skill.level === 'number' && Number.isSafeInteger(skill.level) && skill.level >= 1 && skill.level <= 99).length === 1)
}

export interface PlayerSearchV1 { projectionVersion: 1; results: readonly PublicPlayerProfileV1[] }
export function isPlayerSearchV1(value: unknown): value is PlayerSearchV1 {
  return isRecord(value) && hasExactKeys(value, ['projectionVersion', 'results']) && value.projectionVersion === 1
    && Array.isArray(value.results) && value.results.length <= 12 && value.results.every(isPublicPlayerProfileV1)
}
