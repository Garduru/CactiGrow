import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { AdminAction, AdminAudit, AdminListing, AdminMutation, AdminMutationResult, AdminPermission, AdminPlayerInspection, AdminPlayerSummary, AdminRoleEntry, AdminSpecimen, StaffRole } from '../../../shared/api/adminV1'
import { browserApiClient as api } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useAdminAccess } from './adminAccess'
import './adminTools.css'

const sections = [['Overview', 'admin.access'], ['Players', 'player.search'], ['Support', 'economy.adjust'], ['Specimens', 'specimen.inspect'], ['Marketplace', 'marketplace.inspect'], ['Roles', 'roles.manage'], ['Audit Log', 'audit.read']] as const
function Facts({ values }: { values: Record<string, unknown> }) { return <dl className="admin-tools__facts">{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === null ? 'Unavailable' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> }
function MutationFeedback({ result, targetName }: { result: AdminMutationResult; targetName: string }) {
  const audit = result.audit
  const key = audit.action === 'CURRENCY_ADJUSTED' ? 'balance' : audit.action === 'SKILL_XP_ADJUSTED' ? 'xp' : audit.action === 'SEEDS_ADJUSTED' ? 'quantity' : null
  const delta = audit.after.appliedDelta
  const change = key ? `${key === 'balance' ? '$' : ''}${audit.before[key]} → ${key === 'balance' ? '$' : ''}${audit.after[key]} (${typeof delta === 'number' && delta > 0 ? '+' : ''}${delta})` : null
  return <Facts values={{ Target: targetName, 'Target UUID': audit.targetPlayerId, ...(key ? { [key === 'balance' ? 'Currency' : key === 'xp' ? 'XP' : 'Seeds']: change } : { Before: audit.before, After: audit.after }), Reason: audit.reason, 'Audit ID': audit.id, Replay: result.replayed }} />
}
export function AdminToolsPanel() {
  const access = useAdminAccess()
  return access.session?.permissions.includes('admin.access') ? <AdminContent key={access.session.role} /> : <p role="status">Staff authorization is required. Reload to refresh your permissions.</p>
}
function AdminContent() {
  const access = useAdminAccess(), session = access.session!, location = useLocation()
  const grower = useGrowerAuthority(), lifecycle = usePlantLifecycle()
  const [section, setSection] = useState('Overview'), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [query, setQuery] = useState(''), [results, setResults] = useState<AdminPlayerSummary[]>([]), [selected, setSelected] = useState<AdminPlayerInspection | null>(null)
  const [action, setAction] = useState<AdminAction>('currency'), [delta, setDelta] = useState('1'), [skill, setSkill] = useState<'cultivation' | 'breeding' | 'genetics'>('cultivation')
  const [species, setSpecies] = useState(''), [catalog, setCatalog] = useState<{ speciesId: string; name: string }[]>([])
  const [reason, setReason] = useState(''), [role, setRole] = useState<StaffRole>('MODERATOR'), [ownerConfirmation, setOwnerConfirmation] = useState('')
  const [review, setReview] = useState<{ target: string; targetName: string; action: AdminAction; command: AdminMutation; label: string } | null>(null), [pending, setPending] = useState(false)
  const [lastResult, setLastResult] = useState<AdminMutationResult | null>(null)
  const [lastTargetName, setLastTargetName] = useState('')
  const feedbackRef = useRef<HTMLDivElement>(null)
  const [listings, setListings] = useState<AdminListing[]>([]), [listingFilter, setListingFilter] = useState(''), [listingNext, setListingNext] = useState<number | null>(null)
  const [roles, setRoles] = useState<AdminRoleEntry[]>([]), [rolesNext, setRolesNext] = useState<number | null>(null)
  const [audit, setAudit] = useState<AdminAudit[]>([]), [auditNext, setAuditNext] = useState<number | null>(null), [auditActor, setAuditActor] = useState(''), [auditTarget, setAuditTarget] = useState('')
  const [specimenId, setSpecimenId] = useState(''), [specimen, setSpecimen] = useState<AdminSpecimen | null>(null)
  const allowed = (p: AdminPermission) => session.permissions.includes(p)
  const refreshPermissions = access.refresh
  useEffect(() => { void refreshPermissions() }, [refreshPermissions]) // Opening refreshes persisted permissions once.
  useEffect(() => {
    const feedback = feedbackRef.current, content = feedback?.closest<HTMLElement>('.feature-panel__content')
    if (!message || !feedback || !content) return
    content.scrollTop += feedback.getBoundingClientRect().top - content.getBoundingClientRect().top
  }, [message, lastResult])
  async function work(task: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setMessage('')
    try { await task() } catch (error) { setMessage(error instanceof Error ? error.message : 'Staff request failed.'); if (error instanceof CactiGrowApiError && [401, 403].includes(error.status ?? 0)) await access.refresh() }
    finally { busyRef.current = false; setBusy(false) }
  }
  function propose(target: string, nextAction: AdminAction, label: string) {
    if (nextAction !== 'cancel-listing' && selected?.player.playerId !== target) { setMessage('Select the exact target player before reviewing a correction.'); return }
    if (reason.trim().length < 3 || reason.trim().length > 240) { setMessage('Enter a 3–240 character support reason. Do not include credentials.'); return }
    const command: AdminMutation = { commandId: crypto.randomUUID(), confirmed: true, reason: reason.trim() }
    if (['currency', 'progression', 'inventory'].includes(nextAction)) command.delta = Number(delta)
    if (nextAction === 'progression') command.skillId = skill
    if (nextAction === 'inventory') command.speciesId = species || catalog[0]?.speciesId
    if (nextAction === 'role') { command.role = role; if (role === 'OWNER') command.confirmOwnerPlayerId = ownerConfirmation }
    setLastResult(null)
    setPending(false); setReview({ target, targetName: nextAction === 'cancel-listing' ? target : selected!.player.displayName ?? target, action: nextAction, command, label })
  }
  async function executeReview() {
    if (!review) return
    await work(async () => {
      setPending(true)
      let result: AdminMutationResult
      try { result = await api.mutateAdmin(review.target, review.action, review.command) }
      catch (error) {
        if (error instanceof CactiGrowApiError && error.status && error.status >= 400 && error.status < 500) { setReview(null); setPending(false) }
        throw error
      }
      if (result.audit.actorPlayerId !== session.playerId || result.audit.commandId !== review.command.commandId || (review.action !== 'cancel-listing' && result.audit.targetPlayerId !== review.target)) throw new Error('The API receipt does not match the reviewed actor, target or command. Result unresolved; retry the same command or check Audit Log.')
      setReview(null); setPending(false); setLastResult(result); setLastTargetName(review.targetName); setReason(''); setOwnerConfirmation('')
      setMessage(result.audit.after.appliedDelta === 0 ? 'No change applied: the target is already at the allowed limit. Recorded in the audit log.' : result.replayed ? 'Previously completed correction confirmed; no duplicate change.' : 'Completed and recorded in the audit log.')
      // A committed result is never recast as an unresolved mutation if refresh fails.
      try {
        // Refresh authorization first: self-demotion can remove inspection permission.
        const currentSession = review.action === 'role' ? await access.refresh() : session
        if (review.action !== 'cancel-listing' && currentSession?.permissions.includes('player.inspect')) setSelected(await api.inspectAdminPlayer(review.target))
        if (review.action === 'cancel-listing') {
          const page = await api.getAdminListings(0, listingFilter.trim())
          setListings(page.items); setListingNext(page.nextOffset)
        }
        if (result.audit.targetPlayerId === session.playerId && review.action !== 'role') await Promise.all([grower.refresh(), api.getPlantLifecycleV3().then(lifecycle.applyProjection)])
      } catch { setMessage('Completed and audited. Reload to refresh account projections.') }
    })
  }
  const playerSearch = <><form onSubmit={e => { e.preventDefault(); if (pending) return; void work(async () => { setReview(null); setLastResult(null); setResults((await api.searchAdminPlayers(query)).items); setSelected(null) }) }}><label>Character name or public UUID{allowed('economy.inspect') ? ' / internal UUID' : ''}<input value={query} onChange={e => setQuery(e.target.value)} minLength={2} maxLength={80} required disabled={busy || pending} /></label><button disabled={busy || pending}>Search players</button></form><ul className="admin-tools__results">{results.map(p => <li key={p.playerId}><button disabled={busy || pending} onClick={() => void work(async () => { setReview(null); setLastResult(null); setSelected(await api.inspectAdminPlayer(p.playerId)) })}>{p.displayName ?? 'Unnamed player'} · Level {p.totalLevel} · {p.role}</button></li>)}</ul>{selected && <><h3>{selected.player.displayName ?? 'Unnamed player'}</h3><Facts values={{ 'Internal player UUID': selected.player.playerId, 'Public UUID': selected.player.publicId, 'Joined': selected.player.joinedAt, 'Role': selected.player.role, 'Account status': selected.player.status, 'Total Level': selected.player.totalLevel, ...('currency' in selected ? { Currency: selected.currency } : {}), ...('skills' in selected ? { Skills: selected.skills } : {}), ...('seeds' in selected ? { Seeds: selected.seeds } : {}), ...('social' in selected ? { Social: selected.social } : {}), ...('specimenCount' in selected ? { 'Owned specimens': selected.specimenCount, Favorites: selected.favoriteCount } : {}) }} />{selected.listings?.map(l => <p key={l.id}>Active listing {l.id} · {l.specimenId} · ${l.price}</p>)}</>}</>
  const reasonField = <label>Reason (required; omit secrets)<textarea maxLength={240} minLength={3} value={reason} onChange={e => setReason(e.target.value)} required disabled={busy || pending} /></label>
  return <div className="admin-tools"><nav aria-label="Admin sections">{sections.filter(([, p]) => allowed(p)).map(([name]) => <button key={name} aria-pressed={section === name} disabled={busy || pending} onClick={() => { setSection(name); setReview(null); setLastResult(null); setMessage('') }}>{name}</button>)}</nav><p>{session.environment} · {session.role} · Server-authorized staff access</p>
    {section === 'Overview' && <><Facts values={{ Character: session.displayName, Role: session.role, Permissions: session.permissions.join(', '), Environment: session.environment, 'Worker version': session.version, 'Staff player UUID': session.playerId, Route: location.pathname, 'Admin API': access.status === 'ready' ? 'Authenticated' : access.status }} /><button disabled={busy} onClick={() => void work(async () => { await access.refresh() })}>Refresh permissions</button></>}
    {section === 'Players' && playerSearch}
    {section === 'Support' && <>{playerSearch}{selected && <form onSubmit={e => { e.preventDefault(); propose(selected.player.playerId, action, `${action} correction for ${selected.player.displayName ?? selected.player.playerId}`) }}><label>Correction<select value={action} onChange={e => setAction(e.target.value as AdminAction)} disabled={pending}><option value="currency">Currency</option><option value="progression">Skill XP</option><option value="inventory">Commodity seeds</option></select></label>{action === 'progression' && <label>Skill<select value={skill} onChange={e => setSkill(e.target.value as typeof skill)}><option value="cultivation">Cultivation</option><option value="breeding">Breeding</option><option value="genetics">Genetics</option></select></label>}{action === 'inventory' && <><button type="button" disabled={busy || pending} onClick={() => void work(async () => { setCatalog((await api.getShopCatalog()).items.map(i => ({ speciesId: i.speciesId, name: i.name }))) })}>Load supported seeds</button><label>Seed<select value={species || catalog[0]?.speciesId || ''} onChange={e => setSpecies(e.target.value)} required>{catalog.map(i => <option key={i.speciesId} value={i.speciesId}>{i.name}</option>)}</select></label></>}<label>Signed adjustment<input type="number" step="1" min={action === 'inventory' ? -100 : action === 'currency' ? -100000 : -1000000} max={action === 'inventory' ? 100 : action === 'currency' ? 100000 : 1000000} value={delta} onChange={e => setDelta(e.target.value)} required disabled={busy || pending} /></label>{reasonField}<button disabled={busy || pending || Number(delta) === 0}>Review correction</button></form>}</>}
    {section === 'Specimens' && <><form onSubmit={e => { e.preventDefault(); void work(async () => setSpecimen(await api.inspectAdminSpecimen(specimenId.trim()))) }}><label>Exact specimen UUID<input value={specimenId} onChange={e => setSpecimenId(e.target.value)} required /></label><button disabled={busy}>Inspect specimen</button></form>{specimen && <Facts values={{ ...specimen }} />}<p>Read-only support inspection. Genetic identity and growth schedules cannot be edited here.</p></>}
    {section === 'Marketplace' && <><form onSubmit={e => { e.preventDefault(); void work(async () => { const page = await api.getAdminListings(0, listingFilter.trim()); setListings(page.items); setListingNext(page.nextOffset) }) }}><label>Exact listing, seller or specimen UUID (optional)<input value={listingFilter} onChange={e => setListingFilter(e.target.value)} /></label><button disabled={busy || pending}>Load active listings</button></form>{reasonField}<ul className="admin-tools__results">{listings.map(l => <li key={l.id}><Facts values={{ Listing: l.id, Seller: l.sellerPlayerId, Specimen: l.specimenId, Price: l.price, Status: l.status }} />{allowed('marketplace.moderate') && <button disabled={busy || pending} onClick={() => propose(l.id, 'cancel-listing', `Cancel active listing ${l.id}`)}>Review cancellation</button>}</li>)}</ul>{listingNext !== null && <button disabled={busy} onClick={() => void work(async () => { const page = await api.getAdminListings(listingNext, listingFilter.trim()); setListings(page.items); setListingNext(page.nextOffset) })}>Next listings</button>}</>}
    {section === 'Roles' && <><button disabled={busy || pending} onClick={() => void work(async () => { const page = await api.getAdminRoles(); setRoles(page.items); setRolesNext(page.nextOffset) })}>Load staff roles</button><ul>{roles.map(r => <li key={r.playerId}>{r.displayName ?? 'Unnamed'} · {r.playerId} · {r.role}</li>)}</ul>{rolesNext !== null && <button disabled={busy} onClick={() => void work(async () => { const page = await api.getAdminRoles(rolesNext); setRoles(page.items); setRolesNext(page.nextOffset) })}>Next roles</button>}{playerSearch}{selected && <form onSubmit={e => { e.preventDefault(); propose(selected.player.playerId, 'role', `Change ${selected.player.displayName ?? selected.player.playerId} from ${selected.player.role} to ${role}`) }}><label>New role<select value={role} onChange={e => setRole(e.target.value as StaffRole)} disabled={pending}>{(['PLAYER', 'MODERATOR', 'ADMIN', 'OWNER'] as const).map(r => <option key={r}>{r}</option>)}</select></label>{role === 'OWNER' && <label>Confirm OWNER promotion: type exact internal UUID<input value={ownerConfirmation} onChange={e => setOwnerConfirmation(e.target.value)} required disabled={pending} /></label>}{reasonField}<button disabled={busy || pending || (role === 'OWNER' && ownerConfirmation !== selected.player.playerId)}>Review role change</button></form>}<p>The last OWNER cannot be removed or demoted.</p></>}
    {section === 'Audit Log' && <><form onSubmit={e => { e.preventDefault(); void work(async () => { const page = await api.getAdminAudit(0, { ...(auditActor ? { actor: auditActor.trim() } : {}), ...(auditTarget ? { target: auditTarget.trim() } : {}) }); setAudit(page.items); setAuditNext(page.nextOffset) }) }}><label>Actor UUID (optional)<input value={auditActor} onChange={e => setAuditActor(e.target.value)} /></label><label>Target UUID (optional)<input value={auditTarget} onChange={e => setAuditTarget(e.target.value)} /></label><button disabled={busy}>Load recent audit</button></form>{audit.map(a => <article key={a.id}><h3>{a.action}</h3><Facts values={{ Time: a.createdAt, Actor: a.actorPlayerId, Role: a.actorRole, Target: a.targetPlayerId, Reason: a.reason, Before: a.before, After: a.after }} /></article>)}{auditNext !== null && <button disabled={busy} onClick={() => void work(async () => { const page = await api.getAdminAudit(auditNext, { ...(auditActor ? { actor: auditActor.trim() } : {}), ...(auditTarget ? { target: auditTarget.trim() } : {}) }); setAudit(page.items); setAuditNext(page.nextOffset) })}>Next audit records</button>}</>}
    {review && <section className="admin-tools__review" role="alertdialog" aria-label="Confirm staff action"><h3>{review.label}</h3><Facts values={{ Target: review.targetName, 'Target UUID': review.target, Reason: review.command.reason, ...(review.command.delta !== undefined ? { Adjustment: review.command.delta } : {}), ...(review.command.skillId ? { Skill: review.command.skillId } : {}), ...(review.command.speciesId ? { Species: review.command.speciesId } : {}), ...(review.command.role ? { 'New role': review.command.role } : {}) }} /><p>{pending ? 'Result unresolved. Retry retains the exact command UUID and payload.' : 'Confirm this authoritative change. It will be recorded in the audit log.'}</p><button disabled={busy} onClick={() => void executeReview()}>{pending ? 'Retry same command' : 'Confirm action'}</button><button disabled={busy} onClick={() => { setReview(null); setPending(false) }}>{pending ? 'Dismiss (reload to check result)' : 'Cancel'}</button></section>}
    <div ref={feedbackRef} className="admin-tools__feedback" role="status">{message}{lastResult && <MutationFeedback result={lastResult} targetName={lastTargetName} />}</div>
  </div>
}
