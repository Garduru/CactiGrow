import { isCanonicalUuid } from './identifiers.ts'

export interface ChatLocation { areaId: string; areaName: string; zoneId: string; zoneName: string; town: boolean }
// Temporary topology only. Future registered Areas can supply their own Zone mapping here.
export const STARTER_ZONE = { zoneId: 'starter-zone', zoneName: 'Starter Zone' } as const
export function getChatLocation(areaId: string): ChatLocation | undefined {
  if (areaId === 'town') return { ...STARTER_ZONE, areaId, areaName: 'Town', town: true }
  if (areaId.startsWith('farm-') && isCanonicalUuid(areaId.slice(5))) return { ...STARTER_ZONE, areaId, areaName: 'Farm', town: false }
  return undefined
}
export type PublicChatChannel = 'local' | 'town' | 'world'
export function sharesChatScope(channel: PublicChatChannel, sender: ChatLocation, recipient: ChatLocation): boolean {
  if (channel === 'world') return sender.zoneId === recipient.zoneId
  if (channel === 'town') return sender.town && recipient.town && sender.areaId === recipient.areaId
  return sender.areaId === recipient.areaId
}
