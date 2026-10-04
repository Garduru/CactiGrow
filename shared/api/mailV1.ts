import { hasExactKeys, isRecord } from '../realtime/protocolV1.ts'
import { isCanonicalUuid } from '../realtime/identifiers.ts'

export type MailAttachment = { kind: 'currency'; quantity: number }
  | { kind: 'commodity'; speciesId: string; quantity: number }
  | { kind: 'specimen'; specimenId: string }
export type MailCommand = { type: 'send'; commandId: string; recipientPublicId: string; subject: string; text: string; attachment: MailAttachment | null }
  | { type: 'read' | 'claim'; mailId: string }
export interface MailMessage {
  id: string; senderPublicId: string; senderName: string; recipientPublicId: string; recipientName: string
  subject: string; text: string; sentAt: string; readAt: string | null; claimedAt: string | null; attachment: MailAttachment | null
}
export interface Mailbox { projectionVersion: 1; unreadCount: number; inbox: MailMessage[]; sent: MailMessage[]; hasMoreInbox: boolean; hasMoreSent: boolean }
const commodityIds = ['echinopsis-pachanoi', 'lophophora-williamsii']
export function isMailAttachment(v: unknown): v is MailAttachment {
  if (!isRecord(v)) return false
  if (v.kind === 'specimen') return hasExactKeys(v, ['kind', 'specimenId']) && isCanonicalUuid(v.specimenId)
  return Number.isSafeInteger(v.quantity) && (v.quantity as number) >= 1 && (v.quantity as number) <= 1_000_000
    && (v.kind === 'currency' && hasExactKeys(v, ['kind', 'quantity'])
      || v.kind === 'commodity' && hasExactKeys(v, ['kind', 'speciesId', 'quantity']) && commodityIds.includes(v.speciesId as string) && (v.quantity as number) <= 1000)
}
export function isMailCommand(v: unknown): v is MailCommand {
  if (!isRecord(v)) return false
  if (v.type === 'claim' || v.type === 'read') return hasExactKeys(v, ['type', 'mailId']) && isCanonicalUuid(v.mailId)
  return v.type === 'send' && hasExactKeys(v, ['type', 'commandId', 'recipientPublicId', 'subject', 'text', 'attachment'])
    && isCanonicalUuid(v.commandId) && isCanonicalUuid(v.recipientPublicId)
    && typeof v.subject === 'string' && v.subject.trim().length >= 1 && v.subject.length <= 80
    && typeof v.text === 'string' && v.text.trim().length >= 1 && v.text.length <= 2000
    && !Array.from(v.subject + v.text).some(c => { const code = c.charCodeAt(0); return code < 32 && ![9, 10, 13].includes(code) || code === 127 })
    && (v.attachment === null || isMailAttachment(v.attachment))
}
export function isMailMessage(v: unknown): v is MailMessage {
  if (!isRecord(v) || !hasExactKeys(v, ['id', 'senderPublicId', 'senderName', 'recipientPublicId', 'recipientName', 'subject', 'text', 'sentAt', 'readAt', 'claimedAt', 'attachment'])) return false
  return ['id', 'senderPublicId', 'recipientPublicId'].every(k => isCanonicalUuid(v[k]))
    && ['senderName', 'recipientName', 'subject', 'text'].every(k => typeof v[k] === 'string')
    && typeof v.sentAt === 'string' && Number.isFinite(Date.parse(v.sentAt))
    && ['readAt', 'claimedAt'].every(k => v[k] === null || typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)))
    && (v.attachment === null || isMailAttachment(v.attachment))
}
export function isMailbox(v: unknown): v is Mailbox {
  return isRecord(v) && hasExactKeys(v, ['projectionVersion', 'unreadCount', 'inbox', 'sent', 'hasMoreInbox', 'hasMoreSent']) && v.projectionVersion === 1 && Number.isSafeInteger(v.unreadCount) && (v.unreadCount as number) >= 0
    && Array.isArray(v.inbox) && v.inbox.length <= 50 && v.inbox.every(isMailMessage)
    && Array.isArray(v.sent) && v.sent.length <= 50 && v.sent.every(isMailMessage)
    && typeof v.hasMoreInbox === 'boolean' && typeof v.hasMoreSent === 'boolean'
}
export function isMailReceipt(v: unknown): v is { mailId: string } {
  return isRecord(v) && hasExactKeys(v, ['mailId']) && isCanonicalUuid(v.mailId)
}
