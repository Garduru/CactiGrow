import { useContext, useState } from 'react'
import { isCanonicalUuid } from '../../../shared/realtime/identifiers'
import type { StartingResetCommand } from '../../../shared/api/startingResetV1'
import { browserApiClient } from '../../services/api/browserApiClient'
import { useStartingExperience } from './StartingContext'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { useSocialState } from '../social/useSocialState'
import { PlantLifecycleContext } from '../../app/PlantLifecycleContext'

export function StartingResetControl({ playerId, enabled, recordAction }: { playerId: string | null; enabled: boolean; recordAction(label: string): void }) {
  const tutorial = useStartingExperience(), world = useWorldLocation(), lifecycle = useContext(PlantLifecycleContext), social = useSocialState()
  const [mode, setMode] = useState<StartingResetCommand['mode']>('tutorial')
  const [target, setTarget] = useState(playerId ?? ''), [confirmation, setConfirmation] = useState('')
  const [command, setCommand] = useState<StartingResetCommand | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const valid = isCanonicalUuid(target) && confirmation === target
  async function reset() {
    if (!enabled || busy || !valid) return
    const request = command ?? { commandId: crypto.randomUUID(), targetPlayerId: target, confirmPlayerId: confirmation, mode }
    setCommand(request); setBusy(true); setMessage('Resetting only Starting Experience…')
    try {
      const result = await browserApiClient.resetStartingExperience(request)
      const label = `${request.mode === 'full-onboarding' ? 'Reset Full Character Onboarding' : 'Reset Starting Experience'} for ${result.targetPlayerId}; ${result.starting.nameComplete ? 'name retained' : 'name selection pending'}; appearance pending; Starting Spawn; ${result.clearedNurserySlots?.length ?? 0} Nursery positions cleared; ${result.retiredSpecimenIds.length} specimens and ${result.retiredSeedIds.length} practice seeds archived.`
      recordAction(label); setMessage(label); setCommand(null); setConfirmation('')
      if (result.targetPlayerId === playerId) { world.reload(); await tutorial.refresh(); await lifecycle?.refresh(); await social.refresh() }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Reset failed. Retry uses the same command ID.') }
    finally { setBusy(false) }
  }
  return <section className="dev-tools__card">
    <h3>Reset Starting Experience</h3>
    <p>Staging/local only. Partial reset retains the name and normal Farm plants. Full onboarding requires name selection again and clears ALL Nursery plants, including normal plants, for an empty fresh Farm. Previous tutorial material and displays are archived. Identity, collected normal possessions, Mail, currency, research and history remain. Both modes reset appearance, tutorial, equipment and world discovery; ordinary harvest rewards are not granted twice. Another account requires staff progression and inventory permissions.</p>
    <label>Reset mode<select aria-label="Reset mode" value={mode} disabled={busy || !!command} onChange={e => { setMode(e.target.value as StartingResetCommand['mode']); setConfirmation('') }}><option value="tutorial">Reset Starting Experience - retain name</option><option value="full-onboarding">Reset Full Character Onboarding - choose name again</option></select></label>
    <label>Target internal UUID<input value={target} disabled={busy || !!command} onChange={e => { setTarget(e.target.value.trim()); setConfirmation('') }} /></label>
    <p>Target: <code>{target || 'Enter an internal player UUID'}</code></p>
    <label>Confirm target UUID<input value={confirmation} disabled={busy || !!command} onChange={e => setConfirmation(e.target.value.trim())} /></label>
    <button disabled={!enabled || busy || !valid} onClick={() => void reset()}>{command ? 'Retry Starting Experience reset' : mode === 'full-onboarding' ? 'Reset Full Character Onboarding' : 'Reset Starting Experience'}</button>
    {command && !busy && <button onClick={() => { setCommand(null); setConfirmation(''); setMessage('Request dismissed. Verify server state before repeating a reset.') }}>Dismiss pending reset</button>}
    <p role="status">{message}</p>
  </section>
}
