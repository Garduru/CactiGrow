/** Bounded presentation choices. Persistent authority remains the Starting checkpoint. */
export const SKIN_COLORS = [0xd39a6b, 0xf0c8a0, 0x915e40] as const
export const SHIRT_COLORS = [0xb85e3d, 0x637957, 0x566d84, 0xc9b38a] as const
export const HAIR_COLORS = [0x493329, 0x865033, 0xc3a574, 0xaaa59b] as const
export const PANTS_COLORS = [0x887559, 0x5a483a, 0x4c5253] as const
export const BODY_STYLES = ['Masculine', 'Feminine'] as const
export const HAIR_STYLES = ['Cropped', 'Tied back', 'Wavy crop', 'Long braid'] as const
export const HAT_STYLES = ['No hat', 'Straw brim', 'Trail cap'] as const
export const ACCESSORY_STYLES = ['No accessory', 'Field satchel'] as const
export interface CharacterAppearance {
  skin: number
  shirt: number
  body?: number
  hair?: number
  hairColor?: number
  pants?: number
  hat?: number
  accessory?: number
}
// Keep the original shape for old checkpoints and clients. Omitted V1 modules use index zero.
export const DEFAULT_APPEARANCE: CharacterAppearance = { skin: 0, shirt: 0 }
const bounds = { skin: SKIN_COLORS.length, shirt: SHIRT_COLORS.length, body: BODY_STYLES.length, hair: HAIR_STYLES.length, hairColor: HAIR_COLORS.length, pants: PANTS_COLORS.length, hat: HAT_STYLES.length, accessory: ACCESSORY_STYLES.length } as const
export function isCharacterAppearance(value: unknown): value is CharacterAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const choice = value as Record<string, unknown>
  if (!Object.hasOwn(choice, 'skin') || !Object.hasOwn(choice, 'shirt')) return false
  return Object.keys(choice).every(key => Object.hasOwn(bounds, key) && Number.isInteger(choice[key])
    && (choice[key] as number) >= 0 && (choice[key] as number) < bounds[key as keyof typeof bounds])
}
export function resolveCharacterAppearance(appearance: CharacterAppearance): Required<CharacterAppearance> {
  return { body: 0, hair: 0, hairColor: 0, pants: 0, hat: 0, accessory: 0, ...appearance }
}
export function characterAppearanceKey(appearance: CharacterAppearance): string {
  const a = resolveCharacterAppearance(appearance)
  return [a.body, a.skin, a.hair, a.hairColor, a.shirt, a.pants, a.hat, a.accessory].join('-')
}
export const NPC_APPEARANCES = {
  mara: { npcId: 'mara', displayName: 'Mara', role: 'Field guide', appearance: { skin: 2, shirt: 1, body: 1, hair: 1, hairColor: 3, pants: 1, hat: 1, accessory: 1 } satisfies CharacterAppearance },
} as const
/** Presentation aliases keep existing authored/persisted entity IDs unchanged. */
export const NPC_PRESET_BY_ENTITY_ID: Partial<Record<string, keyof typeof NPC_APPEARANCES>> = { 'mara-guide': 'mara' }
