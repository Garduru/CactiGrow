import { useCallback, useEffect, useRef, useState } from 'react'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { worldInputBoundary } from '../../components/layout/worldInputBoundary'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useGardenAuthority } from '../../app/useGardenAuthority'
import { RecipientSearch } from '../social/RecipientSearch'
import { useSocialState } from '../social/useSocialState'
import { useMailStatus } from './mailStatusContext'
import { GARDEN_AUTHORITY_CHANGED_EVENT } from '../../app/authorityEvents'
import { getSpeciesById } from '../../data/species'
import type { MailAttachment, Mailbox, MailCommand, MailMessage } from '../../../shared/api/mailV1'
import type { PublicPlayerSummaryV1 } from '../../../shared/api/socialV1'

function attachmentLabel(a: MailAttachment | null) {
  if (!a) return 'No attachment'
  return a.kind === 'currency' ? `$${a.quantity}` : a.kind === 'commodity' ? `${a.quantity} ${getSpeciesById(a.speciesId)?.commonName ?? a.speciesId} seeds` : `Specimen ${a.specimenId.slice(0, 8)}`
}
export function MailPage() {
  const grower = useGrowerAuthority(), lifecycle = usePlantLifecycle(), garden = useGardenAuthority(), social = useSocialState()
  const { setUnread } = useMailStatus()
  const [tab, setTab] = useState<'inbox' | 'sent' | 'compose'>('inbox')
  const [mailbox, setMailbox] = useState<Mailbox | null>(null), [opened, setOpened] = useState<string | null>(null)
  const [offset, setOffset] = useState({ inbox: 0, sent: 0 }), [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState('')
  const [recipient, setRecipient] = useState<PublicPlayerSummaryV1 | null>(null)
  const [subject, setSubject] = useState(''), [text, setText] = useState('')
  const [kind, setKind] = useState<'none' | MailAttachment['kind']>('none'), [quantity, setQuantity] = useState('1')
  const [speciesId, setSpeciesId] = useState('echinopsis-pachanoi'), [specimenId, setSpecimenId] = useState('')
  const [review, setReview] = useState(false), [uncertain, setUncertain] = useState(false)
  const pending = useRef<Extract<MailCommand, { type: 'send' }> | null>(null)
  const load = useCallback(async (signal?: AbortSignal) => {
    const projection = await browserApiClient.getMailbox(signal, offset.inbox, offset.sent)
    if (!signal?.aborted) { setMailbox(projection); setUnread(projection.unreadCount) }
  }, [offset.inbox, offset.sent, setUnread])
  useEffect(() => {
    const controller = new AbortController()
    void browserApiClient.getMailbox(controller.signal, offset.inbox, offset.sent).then(projection => { if (!controller.signal.aborted) { setMailbox(projection); setUnread(projection.unreadCount) } }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Mailbox unavailable.') })
    return () => controller.abort()
  }, [offset.inbox, offset.sent, setUnread])
  const projection = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection : null
  const plants = (projection?.ownedSpecimens ?? []).filter(p => !garden.projection?.organization[p.specimenId]?.favorite)
  const attachment: MailAttachment | null = kind === 'currency' ? { kind, quantity: Number(quantity) } : kind === 'commodity' ? { kind, speciesId, quantity: Number(quantity) } : kind === 'specimen' ? { kind, specimenId } : null
  async function reconcile() { window.dispatchEvent(new Event(GARDEN_AUTHORITY_CHANGED_EVENT)); await Promise.all([grower.refresh(), lifecycle.refresh()]) }
  async function mutate(command: MailCommand) {
    if (busy) return
    setBusy(true); setError(''); setFeedback('')
    try {
      await browserApiClient.mutateMail(command)
      if (command.type === 'send') { pending.current = null; setUncertain(false); setReview(false); setSubject(''); setText(''); setKind('none'); setTab('sent'); setFeedback('Mail sent. Attachments await the recipient claim.') }
      else if (command.type === 'claim') setFeedback('Attachment claimed.')
      if (command.type !== 'read') await reconcile()
      await load()
    } catch (e) {
      if (command.type === 'send' && pending.current) {
        const ambiguous = !(e instanceof CactiGrowApiError) || e.kind === 'network' || e.kind === 'invalid-response' || (e.status ?? 500) >= 500
        setUncertain(ambiguous)
        if (!ambiguous) { pending.current = null; setReview(false) }
      }
      setError(e instanceof Error ? e.message : 'Mail operation unavailable.')
    } finally { setBusy(false) }
  }
  async function openMail(m: MailMessage) {
    setOpened(opened === m.id ? null : m.id)
    if (tab === 'inbox' && !m.readAt) await mutate({ type: 'read', mailId: m.id })
  }
  function send() {
    if (!recipient) return
    const command = pending.current ?? { type: 'send' as const, commandId: crypto.randomUUID(), recipientPublicId: recipient.publicId, subject: subject.trim(), text: text.trim(), attachment }
    pending.current = command; void mutate(command)
  }
  return <section {...worldInputBoundary} className="mail-page" aria-labelledby="mail-title" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation() }} onKeyUp={e => { if (e.key !== 'Escape') e.stopPropagation() }}>
    <LocationHeader titleId="mail-title" eyebrow="Social" title="Mailbox" subtitle="Persistent delivery, including when players are offline." />
    <nav aria-label="Mailbox folders">{(['inbox', 'sent', 'compose'] as const).map(t => <button key={t} type="button" disabled={busy || uncertain} aria-current={tab === t ? 'page' : undefined} onClick={() => { setTab(t); setOpened(null); setError('') }}>{t === 'inbox' ? `Inbox${mailbox?.unreadCount ? ` (${mailbox.unreadCount})` : ''}` : t === 'sent' ? 'Sent' : 'Compose'}</button>)}
      <button type="button" disabled={busy} onClick={() => { void load().catch(e => setError(e instanceof Error ? e.message : 'Refresh unavailable.')) }}>Refresh</button></nav>
    {error && <p role="alert">{error}</p>}{feedback && <p role="status">{feedback}</p>}
    {tab === 'compose' ? <div className="mail-compose">
      {!review && <><RecipientSearch onSelect={setRecipient} /><p>To: {recipient?.displayName ?? 'Choose a recipient'}</p>
        <form onSubmit={e => { e.preventDefault(); setReview(true); setError('') }}>
          <label>Subject<input required maxLength={80} value={subject} onChange={e => setSubject(e.target.value)} /></label>
          <label>Message<textarea required maxLength={2000} rows={4} value={text} onChange={e => setText(e.target.value)} /></label>
          <label>Attachment<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="none">None</option><option value="currency">Currency</option><option value="commodity">Commodity seeds</option><option value="specimen">Collected specimen</option></select></label>
          {(kind === 'currency' || kind === 'commodity') && <label>Quantity<input type="number" min={1} max={kind === 'currency' ? 1000000 : 1000} step={1} required value={quantity} onChange={e => setQuantity(e.target.value)} /></label>}
          {kind === 'currency' && <p>Balance: ${grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection.player.tokenBalance : 'unavailable'}</p>}
          {kind === 'commodity' && <label>Seeds<select value={speciesId} onChange={e => setSpeciesId(e.target.value)}>{['echinopsis-pachanoi', 'lophophora-williamsii'].map(id => <option key={id} value={id}>{getSpeciesById(id)?.commonName ?? id} ({projection?.seedStacks.find(s => s.speciesId === id)?.quantity ?? 0} owned)</option>)}</select></label>}
          {kind === 'specimen' && <><label>Specimen<select required value={specimenId} onChange={e => setSpecimenId(e.target.value)}><option value="">Choose a specimen</option>{plants.map(p => <option key={p.specimenId} value={p.specimenId}>{getSpeciesById(p.speciesId)?.commonName ?? p.speciesId} - {p.specimenId.slice(0, 8)}</option>)}</select></label><p>Favorites are protected. Active listings and reserved specimens cannot be mailed.</p></>}
          <button type="submit" disabled={!recipient || !text.trim() || !subject.trim()}>Review mail</button>
        </form></>}
      {review && <div className="mail-review"><strong>Send to {recipient?.displayName}</strong><h3>{subject}</h3><p>{text}</p><p>{attachmentLabel(attachment)}</p><p>Sending reserves this attachment until claimed. It cannot be cancelled. Each player keeps their own research knowledge.</p>
        {uncertain && <p role="status">Delivery is uncertain. Retry uses the same send key and cannot charge twice.</p>}
        <button type="button" disabled={busy} onClick={send}>{busy ? 'Sending...' : uncertain ? 'Retry send' : 'Confirm send'}</button>
        <button type="button" disabled={busy || uncertain} onClick={() => setReview(false)}>Edit</button></div>}
    </div> : <div className="mail-folder">
      {!mailbox && <p role="status">Loading mailbox...</p>}
      {mailbox && (tab === 'inbox' ? mailbox.inbox : mailbox.sent).length === 0 && <p>No mail here yet.</p>}
      {(mailbox ? tab === 'inbox' ? mailbox.inbox : mailbox.sent : []).map(m => <article key={m.id} className={!m.readAt && tab === 'inbox' ? 'mail-message mail-message--unread' : 'mail-message'}>
        <button type="button" className="mail-message__summary" disabled={busy} aria-expanded={opened === m.id} onClick={() => { void openMail(m) }}><strong>{tab === 'inbox' ? m.senderName : `To ${m.recipientName}`} - {m.subject}</strong><time dateTime={m.sentAt}>{new Date(m.sentAt).toLocaleString()}</time><span>{!m.readAt ? 'Unread' : 'Read'}{m.attachment ? ` - ${m.claimedAt ? 'Claimed' : 'Attachment'}` : ''}</span></button>
        {opened === m.id && <div className="mail-message__body"><button type="button" className="social-player-link" onClick={() => social.openProfile(tab === 'inbox' ? m.senderPublicId : m.recipientPublicId)}>{tab === 'inbox' ? m.senderName : m.recipientName}</button><p>{m.text}</p>{m.attachment && <><p>{attachmentLabel(m.attachment)}</p>{tab === 'inbox' && <button type="button" disabled={busy || !!m.claimedAt} onClick={() => { void mutate({ type: 'claim', mailId: m.id }) }}>{m.claimedAt ? 'Claimed' : busy ? 'Claiming...' : 'Claim'}</button>}</>}</div>}
      </article>)}
      <div className="mail-pagination"><button type="button" disabled={busy || offset[tab] === 0} onClick={() => setOffset(v => ({ ...v, [tab]: Math.max(0, v[tab] - 50) }))}>Newer</button><button type="button" disabled={busy || !(tab === 'inbox' ? mailbox?.hasMoreInbox : mailbox?.hasMoreSent)} onClick={() => setOffset(v => ({ ...v, [tab]: v[tab] + 50 }))}>Older</button></div>
    </div>}
  </section>
}
