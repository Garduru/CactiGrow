import type { CollectedPlant } from '../../game/gameState'
import type { GeneticsResearchState } from '../../types/research'
import { projectGeneticKnowledge } from '../research/researchModel'
import { isEligibleForResearch, researchStatus } from './collectionManagement'

export function CollectionKnowledge({ plant, research, level }: { plant: CollectedPlant; research: GeneticsResearchState; level: number }) {
  const record = research.records[plant.cloneLineId]
  const knowledge = projectGeneticKnowledge(plant, record, level)
  const traits = knowledge.visibleFeatures.map((feature) => feature.name).slice(0, 2)
  return <span className="collection-knowledge">
    <span className={`collection-research${record ? ' collection-research--studied' : ''}`}>{record ? '✓ ' : '◌ '}{researchStatus(record)}</span>
    {isEligibleForResearch(plant, record, level) && <small>Research available</small>}
    <small>{record ? traits.join(' · ') || 'No known visible traits' : 'Genetics unknown'}</small>
  </span>
}
