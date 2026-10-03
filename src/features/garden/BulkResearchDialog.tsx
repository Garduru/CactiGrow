import { useRef, useState } from 'react'
import type { CollectedPlant } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { getLevelFromXp } from '../progression/progressionModel'
import { useModalFocus } from '../../components/ui/useModalFocus'
import { canUseBulkResearch, MAX_RESEARCH_BATCH, reviewResearchBatch } from './collectionManagement'

export function BulkResearchDialog({ plants, onClose }: { plants: CollectedPlant[]; onClose: () => void }) {
  const game = useGameState()
  const grower = useGrowerAuthority()
  // The reviewed selection stays fixed, even if filters or ownership change.
  const [reviewed] = useState(() => [...plants])
  const owned = new Map(game.state.ownedPlants.map((plant) => [plant.id, plant]))
  const currentPlants = reviewed.map((plant) => owned.get(plant.id)).filter((plant) => plant !== undefined)
  const currentReview = reviewResearchBatch(currentPlants, game.state.geneticsResearch, getLevelFromXp(game.state.player.skills.genetics.xp))
  const review = { ...currentReview, skipped: currentReview.skipped + reviewed.length - currentPlants.length }
  const [phase, setPhase] = useState<'review' | 'busy' | 'done'>('review')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const disabledReason = !canUseBulkResearch(game.state.property) ? 'Requires Organized Beds (Garden Level 2).'
    : !review.eligible.length ? 'No selected specimens have an available research milestone.'
    : reviewed.length > MAX_RESEARCH_BATCH ? `Select at most ${MAX_RESEARCH_BATCH} specimens per batch.` : ''
  const pending = useRef(false)
  const panel = useRef<HTMLElement>(null)
  useModalFocus(panel, onClose, phase === 'busy', phase)
  async function confirm() {
    if (pending.current || disabledReason) return
    pending.current = true; setPhase('busy'); setError('')
    try {
      if (grower.state.authority === 'server') {
        const projection = await grower.mutate({ type: 'research-specimens', specimenIds: reviewed.map((plant) => plant.id) })
        if (!projection?.researchBatch) throw new Error('Research result could not be confirmed. Check the updated collection before retrying.')
        setNotice(`${projection.researchBatch.succeeded.length} researched · ${projection.researchBatch.skipped.length} skipped · 0 failed`)
      } else {
        let succeeded = 0, failed = 0
        for (const plant of review.eligible) {
          const ok = game.state.geneticsResearch.records[plant.cloneLineId] ? await game.analyzePlant(plant.id) : await game.observePlant(plant.id)
          if (ok) succeeded += 1; else failed += 1
        }
        setNotice(`${succeeded} researched · ${review.skipped} skipped · ${failed} failed`)
      }
      setPhase('done')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Research could not be confirmed. Check collection status before retrying.')
      setPhase('review'); pending.current = false
    }
  }
  return <div className="plant-details-overlay">
    <button className="plant-details__backdrop" type="button" disabled={phase === 'busy'} onClick={onClose} aria-label="Close batch research" />
    <section className="research-workflow" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="batch-research-title">
      <header className="plant-details__header"><h2 id="batch-research-title">Research Selected</h2><button type="button" disabled={phase === 'busy'} onClick={onClose} aria-label="Close batch research">×</button></header>
      {phase === 'review' && <><p>{review.eligible.length} eligible · {review.skipped} skipped</p><p>Advance one available milestone per clone line using your current Genetics level. Shared clone lines, complete research and level-locked milestones are skipped. Favorites may be researched safely.</p><p>The server rechecks ownership and eligibility when you confirm. Existing observation and analysis have no Token cost or timer.</p>{disabledReason && <p id="batch-research-disabled" role="status">{disabledReason}</p>}{error && <p role="alert">{error}</p>}<button className="nursery-button" type="button" disabled={Boolean(disabledReason)} aria-describedby={disabledReason ? "batch-research-disabled" : undefined} onClick={() => void confirm()}>Confirm research</button></>}
      {phase === 'busy' && <p role="status">Researching selected specimens…</p>}
      {phase === 'done' && <><p role="status">{notice}</p><button className="nursery-button" type="button" onClick={onClose}>Done</button></>}
    </section>
  </div>
}
