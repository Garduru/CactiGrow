import { useState } from 'react'
import type { SocialPanelTab } from './socialPanelState'
import { useSocialState } from './useSocialState'

type ChatMode = Extract<SocialPanelTab, 'messages' | 'world-chat'>

export function ChatConversation({ mode, compact = false }: { mode: ChatMode; compact?: boolean }) {
  const social = useSocialState()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const overview = social.state.status === 'ready' ? social.state.overview : null
  const currentRecipient = overview?.friends.find((friend) => friend.publicId === social.directRecipientPublicId)
  const ownPublicId = overview?.ownProfile?.publicId
  const messages = mode === 'world-chat'
    ? social.chatMessages.filter((message) => message.channel === 'world')
    : social.chatMessages.filter((message) => message.channel === 'direct' && currentRecipient !== undefined && ownPublicId !== undefined
      && ((message.senderPublicId === currentRecipient.publicId && message.recipientPublicId === ownPublicId)
        || (message.senderPublicId === ownPublicId && message.recipientPublicId === currentRecipient.publicId)))
  const connected = social.chatStatus === 'Connected to Town Chat.'
  const label = mode === 'world-chat' ? 'World Chat' : 'Direct Messages'

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!connected || (mode === 'messages' && !currentRecipient)) return
    const sent = mode === 'world-chat' ? social.sendWorldMessage(draft) : social.sendDirectMessage(draft)
    if (!sent) { setError('Message could not be sent. Reconnect to Town and try again.'); return }
    setDraft('')
    setError('')
  }

  return <section className={compact ? 'chat-conversation chat-conversation--compact' : 'chat-conversation'} aria-label={label}>
    {mode === 'messages' && <aside className="chat-conversation__people" aria-label="Friends">
      <strong>Friends</strong>
      {(overview?.friends ?? []).length === 0 && <p>No friends to message yet.</p>}
      {(overview?.friends ?? []).map((friend) => <div key={friend.publicId} className="chat-conversation__friend">
        <button type="button" className="social-player-link" onClick={() => social.openProfile(friend.publicId)}>{friend.displayName}</button>
        <button type="button" aria-pressed={social.directRecipientPublicId === friend.publicId}
          onClick={() => { social.setDirectRecipient(friend.publicId); setError('') }}>Message</button>
      </div>)}
    </aside>}
    <div className="chat-conversation__thread">
      <header><strong>{mode === 'messages' ? currentRecipient?.displayName ?? 'Choose a friend' : 'Town · Local'}</strong><span role="status">{social.chatStatus}</span></header>
      <div className="chat-conversation__messages" role="log" aria-live="polite" aria-label={`${label} messages`}>
        {messages.map((message) => <p key={message.id}>
          <button type="button" className="social-player-link" onClick={() => social.openProfile(message.senderPublicId)}>{message.senderDisplayName}</button>
          <time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          <span>{message.text}</span>
        </p>)}
        {messages.length === 0 && <p className="chat-conversation__empty">{mode === 'messages' && !currentRecipient ? 'Select a friend to open a conversation.'
          : connected ? 'No messages yet.' : 'Enter Town to join the live conversation.'}</p>}
      </div>
      <form className="chat-conversation__composer" aria-label={`${label} message composer`} onSubmit={submit}>
        <label className="sr-only" htmlFor={compact ? 'town-chat-message' : `social-chat-message-${mode}`}>Message</label>
        <input id={compact ? 'town-chat-message' : `social-chat-message-${mode}`} value={draft} maxLength={500} disabled={!connected || (mode === 'messages' && !currentRecipient)}
          onChange={(event) => { setDraft(event.target.value); setError('') }} placeholder={connected ? 'Write a message' : 'Connect to Town to chat'} />
        <button type="submit" disabled={!draft.trim() || !connected || (mode === 'messages' && !currentRecipient)}>Send</button>
      </form>
      {(error || social.chatError) && <p className="chat-conversation__error" role="alert">{error || social.chatError}</p>}
    </div>
  </section>
}