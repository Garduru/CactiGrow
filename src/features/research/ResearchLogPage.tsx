import { useState } from 'react'
import { useGameState } from '../../game/useGameState'
import { getLevelFromXp } from '../progression/progressionModel'
import { GeneticKnowledgeView } from './GeneticKnowledgeView'
import { getResearchDepthDefinition } from './researchConfig'
import { projectGeneticKnowledge } from './researchModel'

export function ResearchLogPage() {
  const { state, comparePlants } = useGameState()
  const [firstPlantId, setFirstPlantId] = useState('')
  const [secondPlantId, setSecondPlantId] = useState('')
  const level = getLevelFromXp(state.player.skills.genetics.xp)
  const records = Object.values(state.geneticsResearch.records)
  const researchedPlants = state.ownedPlants.filter((plant) => state.geneticsResearch.records[plant.cloneLineId])
  const discoveryIds = state.geneticsResearch.completedDiscoveryMilestoneIds
  const speciesCount = discoveryIds.filter((id) => id.startsWith('species:')).length
  const generaCount = discoveryIds.filter((id) => id.startsWith('genus:')).length
  const featureCount = discoveryIds.filter((id) => id.startsWith('feature:')).length
  const rareFindingCount = discoveryIds.filter((id) => id.startsWith('finding:')).length
  const firstPlant = state.ownedPlants.find((plant) => plant.id === firstPlantId)
  const secondPlant = state.ownedPlants.find((plant) => plant.id === secondPlantId)

  return (
    <section aria-labelledby="research-log-title">
      <div className="research-log__heading">
        <div><span className="eyebrow">Genetics Level {level}</span><h1 id="research-log-title">Research Log</h1></div>
        <p>Permanent knowledge about genetic individuals you have studied.</p>
      </div>

      <div className="research-summary" aria-label="Research Log summary">
        <div><span>Clone Lines Studied</span><strong>{records.length}</strong></div>
        <div><span>Species Researched</span><strong>{speciesCount}</strong></div>
        <div><span>Genera Researched</span><strong>{generaCount}</strong></div>
        <div><span>Genetic Features</span><strong>{featureCount}</strong></div>
        <div><span>Rare Findings</span><strong>{rareFindingCount}</strong></div>
      </div>

      <section className="research-comparison" aria-labelledby="comparison-title">
        <div><h2 id="comparison-title">Specimen Comparison</h2><p>Compare observed facts from two owned clone lines. This is not clone verification.</p></div>
        {level < 5 ? <strong>Unlocks at Genetics Level 5</strong> : (
          <div className="research-comparison__controls">
            <label>First specimen<select value={firstPlantId} onChange={(event) => setFirstPlantId(event.target.value)}><option value="">Choose specimen</option>{researchedPlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.id}</option>)}</select></label>
            <label>Second specimen<select value={secondPlantId} onChange={(event) => setSecondPlantId(event.target.value)}><option value="">Choose specimen</option>{researchedPlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.id}</option>)}</select></label>
            <button type="button" onClick={() => comparePlants(firstPlantId, secondPlantId)} disabled={!firstPlant || !secondPlant || firstPlant.cloneLineId === secondPlant.cloneLineId}>Record comparison</button>
          </div>
        )}
        {firstPlant && secondPlant && firstPlant.cloneLineId !== secondPlant.cloneLineId && (
          <div className="research-comparison__results">
            <GeneticKnowledgeView knowledge={projectGeneticKnowledge(firstPlant, state.geneticsResearch.records[firstPlant.cloneLineId], level)} />
            <GeneticKnowledgeView knowledge={projectGeneticKnowledge(secondPlant, state.geneticsResearch.records[secondPlant.cloneLineId], level)} />
          </div>
        )}
      </section>

      {records.length ? (
        <div className="research-log__grid">
          {records.map((record) => {
            const ownedPlant = state.ownedPlants.find((plant) => plant.cloneLineId === record.cloneLineId)
            const knowledge = projectGeneticKnowledge(ownedPlant, record, level)
            return (
              <article className="research-record" key={record.cloneLineId}>
                <header><div><span>{getResearchDepthDefinition(record.analysisDepth).label}</span><h2>{knowledge.speciesName ?? 'Unknown cactus'}</h2><em>{knowledge.scientificName}</em></div><strong>{ownedPlant ? 'Owned specimen available' : 'Historical record'}</strong></header>
                <GeneticKnowledgeView knowledge={knowledge} />
                <dl className="research-record__dates"><div><dt>First analyzed</dt><dd>{new Date(record.firstAnalyzedAt).toLocaleDateString()}</dd></div><div><dt>Latest analysis</dt><dd>{new Date(record.lastAnalyzedAt).toLocaleDateString()}</dd></div></dl>
              </article>
            )
          })}
        </div>
      ) : <div className="garden-empty"><strong>No clone lines studied yet</strong><span>Open an owned specimen in Garden and choose Study Genetics.</span></div>}
    </section>
  )
}
