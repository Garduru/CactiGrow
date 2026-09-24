declare const identityKind: unique symbol
type Identity<Kind extends string> = string & { readonly [identityKind]: Kind }

export type AreaId = Identity<'area'>
export type LayerId = Identity<'layer'>
export type PlayerId = Identity<'player'>
export type PresenceId = Identity<'presence'>
export type ConnectionGeneration = number & { readonly [identityKind]: 'generation' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
// Guards do not normalize their input: require the same representation as the constructors.
export function isCanonicalUuid(value: unknown): value is string { return isUuid(value) && value === value.toLowerCase() }
export function isSequence(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
export function isGeneration(value: unknown): value is ConnectionGeneration { return isSequence(value) && value > 0 }

export function areaId(value: string): AreaId {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(value)) throw new Error('Invalid Area identifier.')
  return value as AreaId
}
function uuid<Kind extends string>(value: string): Identity<Kind> {
  if (!isUuid(value)) throw new Error('Invalid UUID identifier.')
  return value.toLowerCase() as Identity<Kind>
}
// Layer and presence values must be allocated by the future server adapter.
// These constructors validate shape only; they neither generate IDs nor prove authority.
export const layerId = (value: string): LayerId => uuid<'layer'>(value)
export const playerId = (value: string): PlayerId => uuid<'player'>(value)
export const presenceId = (value: string): PresenceId => uuid<'presence'>(value)
export function connectionGeneration(value: number): ConnectionGeneration {
  if (!isGeneration(value)) throw new Error('Invalid connection generation.')
  return value
}
