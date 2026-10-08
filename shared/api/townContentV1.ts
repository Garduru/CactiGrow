import { isCanonicalUuid } from '../realtime/identifiers.ts'
import type { WorldPoint } from '../world/types.ts'

export const TOWN_BOARD_ENTITY_ID = 'town-community-board'
export const TOWN_CONTENT = { areaId: 'town-p1', boardEntityId: TOWN_BOARD_ENTITY_ID } as const
export const TOWN_NPC_ENTITY_IDS = ['town-rosa-steward', 'town-tomas-shopkeeper', 'town-inez-botanist'] as const
export const TOWN_NPC_IDS = TOWN_NPC_ENTITY_IDS
export type TownNpcId = typeof TOWN_NPC_IDS[number]
export const TOWN_INTERACTION_RADIUS = 96
export interface TownContentProjectionV1 {
  projectionVersion: 1
  revision: number
  contacts: { entityId: TownNpcId; firstMetAt: string | null }[]
  townDiscoveredAt: string | null
}
export type TownContentCommandV1 = { v: 1; commandId: string; type: 'talk'; entityId: TownNpcId; expectedWorldRevision: number; position: WorldPoint }
export type TownContentCommandInput = Omit<TownContentCommandV1, 'v' | 'commandId'>
export interface TownContentResultV1 { projection: TownContentProjectionV1; firstContact?: boolean }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const timestamp = (value: unknown) => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value))
export function isTownContentCommandV1(value: unknown): value is TownContentCommandV1 {
  return record(value) && Object.keys(value).sort().join(',') === 'commandId,entityId,expectedWorldRevision,position,type,v'
    && value.v === 1 && isCanonicalUuid(value.commandId) && value.type === 'talk'
    && TOWN_NPC_IDS.includes(value.entityId as TownNpcId) && revision(value.expectedWorldRevision)
    && record(value.position) && Object.keys(value.position).sort().join(',') === 'x,y'
    && [value.position.x, value.position.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000)
}
export function isTownContentProjectionV1(value: unknown): value is TownContentProjectionV1 {
  return record(value) && value.projectionVersion === 1 && revision(value.revision) && timestamp(value.townDiscoveredAt)
    && Array.isArray(value.contacts) && value.contacts.length === TOWN_NPC_IDS.length
    && value.contacts.every((contact, index) => record(contact) && contact.entityId === TOWN_NPC_IDS[index] && timestamp(contact.firstMetAt))
}
export function isTownContentResultV1(value: unknown): value is TownContentResultV1 {
  return record(value) && isTownContentProjectionV1(value.projection) && (value.firstContact === undefined || typeof value.firstContact === 'boolean')
}
