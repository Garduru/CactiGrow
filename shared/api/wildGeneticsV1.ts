import { isCanonicalUuid } from '../realtime/identifiers.ts'

export type WildFindRarity = 'uncommon' | 'rare'
export type WildFindOutcome = 'normal' | WildFindRarity
export interface WildProvenanceV1 {
  v: 1
  lotId: string
  sourceNodeId: string
  populationId: string
  areaId: string
  region: string
  label: string
  rarity: WildFindRarity
  harvestedAt: string
  harvestCommandId: string
  sourceVersion: number
}
/** Inventory intentionally exposes provenance and seed identities, not hidden genetics. */
export interface WildSeedLotV1 {
  lotId: string
  speciesId: string
  provenance: WildProvenanceV1
  seedIds: string[]
  quantity: number
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function isWildProvenanceV1(v: unknown): v is WildProvenanceV1 {
  return object(v) && Object.keys(v).sort().join(',') === 'areaId,harvestCommandId,harvestedAt,label,lotId,populationId,rarity,region,sourceNodeId,sourceVersion,v'
    && v.v === 1 && isCanonicalUuid(v.lotId) && isCanonicalUuid(v.harvestCommandId)
    && ['sourceNodeId', 'populationId', 'areaId'].every(k => typeof v[k] === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(v[k] as string))
    && ['region', 'label'].every(k => typeof v[k] === 'string' && (v[k] as string).length > 0 && (v[k] as string).length <= 120)
    && (v.rarity === 'uncommon' || v.rarity === 'rare') && typeof v.harvestedAt === 'string' && Number.isFinite(Date.parse(v.harvestedAt))
    && Number.isSafeInteger(v.sourceVersion) && Number(v.sourceVersion) >= 1
}
export function isWildSeedLotV1(v: unknown): v is WildSeedLotV1 {
  return object(v) && Object.keys(v).sort().join(',') === 'lotId,provenance,quantity,seedIds,speciesId'
    && isCanonicalUuid(v.lotId) && typeof v.speciesId === 'string' && isWildProvenanceV1(v.provenance) && v.provenance.lotId === v.lotId
    && Array.isArray(v.seedIds) && v.seedIds.length > 0 && v.seedIds.length <= 10 && v.seedIds.every(isCanonicalUuid)
    && new Set(v.seedIds).size === v.seedIds.length && v.quantity === v.seedIds.length
}
