import { areaFromRuntime, zoneName } from '../world/world.ts'

export interface ChatLocation { areaId: string; areaName: string; zoneId: string; zoneName: string; town: boolean }
export function getChatLocation(areaId: string): ChatLocation | undefined {
  const area = areaFromRuntime(areaId)
  return area ? { areaId, areaName: area.displayName, zoneId: area.zoneId, zoneName: zoneName(area.zoneId), town: area.areaType === 'town' } : undefined
}
export type PublicChatChannel = 'local' | 'town' | 'world'
export function sharesChatScope(channel: PublicChatChannel, sender: ChatLocation, recipient: ChatLocation): boolean {
  if (channel === 'world') return sender.zoneId === recipient.zoneId
  if (channel === 'town') return sender.town && recipient.town && sender.areaId === recipient.areaId
  return sender.areaId === recipient.areaId
}
