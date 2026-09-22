import { useEffect, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import type { GeneticExtract } from '../../types/lab'
import { extractTargetLabels } from './extractionModel'
import { canApplyQuantitativeTreatment } from './treatmentModel'
import { QUANTITATIVE_TREATMENT_LAB_TIER, QUANTITATIVE_TREATMENT_LEVEL } from './treatmentModel'
import { getLevelFromXp } from '../progression/progressionModel'

export function SeedTreatmentWorkflow({ extract, onClose }: { extract: GeneticExtract; onClose: () => void }) {
  const { state, applyTreatment } = useGameState()
  const [seedId, setSeedId] = useState('')
  const seed = state.bredSeeds.find((entry) => entry.id === seedId)
  const eligibleSeeds = state.bredSeeds.filter((entry) => canApplyQuantitativeTreatment(state.geneticsLab, state.player, entry, extract))
  const donorSpecies = getSpeciesById(extract.donorSpeciesId)
  const geneticsLevel = getLevelFromXp(state.player.skills.genetics.xp)
  const emptyReason = geneticsLevel < QUANTITATIVE_TREATMENT_LEVEL
    ? `Requires Genetics Level ${QUANTITATIVE_TREATMENT_LEVEL}.`
    : state.geneticsLab.tier < QUANTITATIVE_TREATMENT_LAB_TIER
      ? `Requires Genetics Lab Tier ${QUANTITATIVE_TREATMENT_LAB_TIER}.`
      : 'No untreated unique bred seeds are eligible.'
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [onClose])

  return <div className="treatment-overlay"><button className="plant-details__backdrop" type="button" onClick={onClose} aria-label="Close seed treatment" /><section className="treatment-workflow" role="dialog" aria-modal="true" aria-labelledby="treatment-title">
    <header><div><span className="eyebrow">Quantitative intervention</span><h2 id="treatment-title">Apply Extract to Seed</h2></div><button type="button" onClick={onClose} aria-label="Close seed treatment">×</button></header>
    <dl><div><dt>Target</dt><dd>{extractTargetLabels[extract.target]}</dd></div><div><dt>Quality</dt><dd>{extract.extractionQualityBand} · {extract.extractionQuality}/100</dd></div><div><dt>Potency</dt><dd>{extract.potency}/100</dd></div><div><dt>Donor species</dt><dd>{donorSpecies?.commonName ?? extract.donorSpeciesId}</dd></div><div><dt>Donor clone line</dt><dd>{extract.donorCloneLineId}</dd></div><div><dt>Source sample</dt><dd>{extract.sourceTissueSampleId}</dd></div></dl>
    <label>Eligible unique bred seed<select value={seedId} onChange={(event) => setSeedId(event.target.value)}><option value="">Choose a seed</option>{eligibleSeeds.map((entry) => <option key={entry.id} value={entry.id}>{getSpeciesById(entry.speciesId)?.commonName ?? entry.speciesId} · {entry.id}{entry.isHybrid ? ' · Hybrid' : ''}</option>)}</select></label>
    {seed && <div className="treatment-seed-preview"><strong>{getSpeciesById(seed.speciesId)?.commonName ?? seed.speciesId}</strong><span>Parents: {seed.parentPlantIds.join(' + ')}</span><span>{extractTargetLabels[extract.target]} currently {seed.genetics[extract.target]}</span></div>}
    <p>One extract will be consumed. This seed can receive one quantitative treatment. Its target may improve when planted, but improvement is not guaranteed.</p>
    {!eligibleSeeds.length && <p role="status">{emptyReason}</p>}
    <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!seed || !canApplyQuantitativeTreatment(state.geneticsLab, state.player, seed, extract)} onClick={async () => { if (await applyTreatment(extract.id, seedId)) onClose() }}>Apply treatment</button></footer>
  </section></div>
}
