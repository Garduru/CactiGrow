import { useEffect, useRef, useState } from 'react'
import type { SocialPanelTab } from './socialPanelState'
import type { PublicPlayerSummaryV1 } from '../../../shared/api/socialV1'
import { useSocialState } from './useSocialState'
import { browserApiClient } from '../../services/api/browserApiClient'
import { RecipientSearch } from './RecipientSearch'
import { useFeaturePanel } from '../menu/featurePanelState'

type ChatMode = Exclude<SocialPanelTab, 'friends'>
export function ChatConversation({ mode, compact = false }: { mode: ChatMode; compact?: boolean }) {
  const social = useSocialState(), { openFeature } = useFeaturePanel()
  const [draft, setDraft] = useState(''), [error, setError] = useState(''), [finding, setFinding] = useState(false)
  const [selected, setSelected] = useState<PublicPlayerSummaryV1 | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const overview = social.state.status === 'ready' ? social.state.overview : null
  const ownPublicId = overview?.ownProfile?.publicId
  const recipientId = social.directRecipientPublicId
  const currentRecipient = overview?.friends.find(p => p.publicId === recipientId) ?? (selected?.publicId === recipientId ? selected : null)
  useEffect(() => {
    if (!recipientId || currentRecipient) return
    const controller = new AbortController()
    void browserApiClient.getPublicPlayerProfile(recipientId, controller.signal).then(p => { if (!controller.signal.aborted) setSelected(p.profile) }).catch(() => {})
    return () => controller.abort()
  }, [recipientId, currentRecipient])
  const channel = mode === 'messages' ? 'direct' : mode === 'local-chat' ? 'local' : mode === 'town-chat' ? 'town' : 'world'
  const messages = social.chatMessages.filter(m => m.channel === channel && (channel !== 'direct'
    || recipientId && (m.senderPublicId === recipientId && m.recipientPublicId === ownPublicId || m.senderPublicId === ownPublicId && m.recipientPublicId === recipientId)))
  const available = social.chatConnected && (channel !== 'town' || social.chatLocation?.town)
  const context = channel === 'local' ? `Local - ${social.chatLocation?.areaName ?? 'Location unavailable'}`
    : channel === 'world' ? `World - ${social.chatLocation?.zoneName ?? 'Zone unavailable'}` : channel === 'town' ? 'Town' : currentRecipient?.displayName ?? 'Choose a player'
  const unavailable = channel === 'town' && !social.chatLocation?.town ? 'Enter Town to join Town chat.' : social.chatStatus
  const recentIds = [...new Set([...social.chatMessages].reverse().filter(m => m.channel === 'direct').map(m => m.senderPublicId === ownPublicId ? m.recipientPublicId : m.senderPublicId))].filter((id): id is string => !!id)
  const recent = recentIds.slice(0, 8).map(id => ({ id, name: overview?.friends.find(p => p.publicId === id)?.displayName
    ?? (currentRecipient?.publicId === id ? currentRecipient.displayName : social.chatMessages.find(m => m.senderPublicId === id)?.senderDisplayName ?? 'Conversation') }))
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [social.chatMessages.length, mode, recipientId])
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!available || channel === 'direct' && !recipientId) return
    const sent = channel === 'direct' ? social.sendDirectMessage(draft) : social.sendPublicMessage(channel, draft)
    if (!sent) { setError('Unable to send. Check your connection and try again.'); return }
    setDraft(''); setError('')
  }
  return <section className={compact ? 'chat-conversation chat-conversation--compact' : 'chat-conversation'} aria-label={context}>
    {channel === 'direct' && <aside className="chat-conversation__people" aria-label="Conversations">
      <button type="button" onClick={() => setFinding(v => !v)}>{finding ? 'Close search' : 'Find player'}</button>
      {recent.map(p => <button key={p.id} type="button" aria-pressed={recipientId === p.id} onClick={() => social.setDirectRecipient(p.id)}>{p.name}</button>)}
      {(overview?.friends ?? []).filter(p => !recentIds.includes(p.publicId)).map(p => <button key={p.publicId} type="button" onClick={() => social.setDirectRecipient(p.publicId)}>{p.displayName}</button>)}
    </aside>}
    <div className="chat-conversation__thread">
      <header><strong>{context}</strong><span role="status">{available ? channel === 'direct' ? 'Live delivery requires recipient online' : 'Connected' : unavailable}</span></header>
      {finding && channel === 'direct' && <RecipientSearch onSelect={p => { setSelected(p); social.setDirectRecipient(p.publicId); setFinding(false); setError('') }} />}
      <div ref={log} className="chat-conversation__messages" role="log" aria-live="polite" aria-label={`${context} messages`}>
        {messages.map(m => <p key={m.id}><button type="button" className="social-player-link" onClick={() => social.openProfile(m.senderPublicId)}>{m.senderDisplayName}</button>
          <time dateTime={new Date(m.sentAt).toISOString()}>{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>{m.text}</span></p>)}
        {!messages.length && <p className="chat-conversation__empty">{!available ? unavailable : channel === 'direct' && !recipientId ? 'Choose a player or find a character name.' : 'No messages yet.'}</p>}
      </div>
      <form className="chat-conversation__composer" onSubmit={submit} aria-label={`${context} message composer`}>
        <label className="sr-only" htmlFor={compact ? 'chat-message' : `social-chat-${mode}`}>Message</label>
        <input id={compact ? 'chat-message' : `social-chat-${mode}`} value={draft} maxLength={500} disabled={!available || channel === 'direct' && !recipientId}
          onChange={e => { setDraft(e.target.value); setError('') }} placeholder={available ? 'Write a message' : unavailable} />
        <button type="submit" disabled={!draft.trim() || !available || channel === 'direct' && !recipientId}>Send</button>
      </form>
      {(error || social.chatError) && <p className="chat-conversation__error" role="alert">{error || social.chatError}
        {channel === 'direct' && <button type="button" onClick={() => openFeature('mail')}>Use Mail</button>}</p>}
    </div>
  </section>
}
