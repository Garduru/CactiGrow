import { useId } from 'react'
import type { CollectedPlant } from '../../game/gameState'
import type { GeneticsResearchState } from '../../types/research'
import { canUseBulkResearch, MAX_RESEARCH_BATCH, reviewResearchBatch } from './collectionManagement'

export function ResearchSelectionAction({ plants, research, level, property, dialogOpen, onOpen }: {
  plants: CollectedPlant[]
  research: GeneticsResearchState
  level: number
  property: Parameters<typeof canUseBulkResearch>[0]
  dialogOpen: boolean
  onOpen: () => void
}) {
  const descriptionId = useId()
  const review = reviewResearchBatch(plants, research, level)
  const reason = !canUseBulkResearch(property) ? 'Requires Organized Beds (Garden Level 2).'
    : dialogOpen ? 'Finish the open research dialog.'
    : !plants.length ? 'Select specimens to research.'
    : !review.eligible.length ? 'No selected specimens have an available research milestone.'
    : plants.length > MAX_RESEARCH_BATCH ? `Select at most ${MAX_RESEARCH_BATCH} specimens per batch.`
    : ''
  return <div className="collection-research-action">
    <button className="cg-button" type="button" disabled={Boolean(reason)} aria-describedby={descriptionId} title={reason || 'Review selected specimens before confirming research.'} onClick={onOpen}>Research Selected</button>
    <small id={descriptionId} role="status">{reason || `${review.eligible.length} eligible · ${review.skipped} skipped`}</small>
  </div>
}
