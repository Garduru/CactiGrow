import type { ChatLocation, PublicChatChannel } from '../../../shared/realtime/chatLocation'
import { createContext } from 'react'
import type { SocialCommandV1, SocialOverviewV1 } from '../../../shared/api/socialV1'
import type { AreaConnection } from '../../services/realtime/AreaConnection'
import type { PublicChatMessageV1 } from '../../../shared/realtime/protocolV1'

export type SocialLoadState = { status: 'loading' } | { status: 'ready'; overview: SocialOverviewV1; refreshError?: string } | { status: 'error'; message: string }
export type ProfileTarget = { open: false } | { open: true; publicId: string | null }

export interface SocialContextValue {
  state: SocialLoadState
  mutate(command: SocialCommandV1): Promise<void>
  refresh(): void
  profileTarget: ProfileTarget
  openProfile(publicId: string | null): void
  closeProfile(): void
  connection: AreaConnection
  chatLocation: ChatLocation | null
  chatConnected: boolean
  sendPublicMessage(channel: PublicChatChannel, text: string): boolean
  chatStatus: string
  chatError: string
  chatMessages: readonly PublicChatMessageV1[]
  directRecipientPublicId: string | null
  setDirectRecipient(publicId: string | null): void
  sendWorldMessage(text: string): boolean
  sendDirectMessage(text: string): boolean
}

export const SocialContext = createContext<SocialContextValue | null>(null)
