import assert from 'node:assert/strict'
import test from 'node:test'
import { isMailAttachment, isMailCommand, isMailbox, isMailReceipt } from './mailV1.ts'

const id = '11111111-1111-4111-8111-111111111111'
const command = { type: 'send', commandId: id, recipientPublicId: id, subject: 'Hello', text: 'A message\nwith a newline.', attachment: null }
test('Mail intent rejects unknown fields, malformed identity, unbounded text and unsupported valuables', () => {
  assert.equal(isMailCommand(command), true)
  for (const invalid of [{ ...command, playerId: id }, { ...command, commandId: 'invented' }, { ...command, subject: ' ' }, { ...command, subject: 'x'.repeat(81) }, { ...command, text: 'x'.repeat(2001) }, { ...command, text: '\u0000' }]) assert.equal(isMailCommand(invalid), false)
  for (const invalid of [{kind:'currency',quantity:0},{kind:'currency',quantity:NaN},{kind:'currency',quantity:Infinity},{kind:'currency',quantity:1.5},{kind:'currency',quantity:1000001},{kind:'currency',quantity:1,balance:100},{kind:'commodity',speciesId:'unsupported',quantity:1},{kind:'commodity',speciesId:'echinopsis-pachanoi',quantity:1001},{kind:'specimen',specimenId:'invented'}]) assert.equal(isMailAttachment(invalid), false)
  assert.equal(isMailAttachment({kind:'currency',quantity:1000000}),true)
  assert.equal(isMailAttachment({kind:'commodity',speciesId:'lophophora-williamsii',quantity:1000}),true)
  assert.equal(isMailAttachment({kind:'specimen',specimenId:id}),true)
})
test('Mailbox and receipts expose bounded public identities without extra internal fields', () => {
  const message = {id,senderPublicId:id,senderName:'Sender',recipientPublicId:id,recipientName:'Recipient',subject:'Hello',text:'Message',sentAt:'2026-10-04T00:00:00.000Z',readAt:null,claimedAt:null,attachment:null}
  const mailbox = {projectionVersion:1,unreadCount:1,inbox:[message],sent:[],hasMoreInbox:false,hasMoreSent:false}
  assert.equal(isMailbox(mailbox),true)
  for (const invalid of [{...mailbox,unreadCount:-1},{...mailbox,inbox:Array(51).fill(message)},{...mailbox,inbox:[{...message,senderPlayerId:id}]},{...mailbox,inbox:[{...message,sentAt:'invalid'}]}]) assert.equal(isMailbox(invalid),false)
  assert.equal(isMailReceipt({mailId:id}),true)
  assert.equal(isMailReceipt({mailId:'invented'}),false)
  assert.equal(isMailReceipt({mailId:id,playerId:id}),false)
})
