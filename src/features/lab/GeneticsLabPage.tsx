import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import type { ExtractionAttempt, QuantitativeExtractTarget } from '../../types/lab'
import { getLevelFromXp } from '../progression/progressionModel'
import { getSkillUnlocks } from '../progression/skillDefinitions'
import { canExtractQuantitative, extractTargetLabels, quantitativeExtractTargets, QUANTITATIVE_EXTRACTION_LAB_TIER, QUANTITATIVE_EXTRACTION_LEVEL } from './extractionModel'
import { geneticsLabTiers, getLabTierDefinition, TISSUE_SAMPLING_LAB_TIER, TISSUE_SAMPLING_LEVEL } from './labConfig'

export function GeneticsLabPage() {
  const { state, upgradeLab, extractFromSample } = useGameState()
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [target, setTarget] = useState<QuantitativeExtractTarget>('vigor')
  const [result, setResult] = useState<ExtractionAttempt | null>(null)
  const extractionLock = useRef(false)
  const level = getLevelFromXp(state.player.skills.genetics.xp)
  const current = getLabTierDefinition(state.geneticsLab.tier)
  const next = geneticsLabTiers.find((tier) => tier.id === state.geneticsLab.tier + 1)
  const selectedSample = state.geneticsLab.tissueSamples.find((sample) => sample.id === selectedSampleId)
  const canExtract = canExtractQuantitative(state.geneticsLab, level, selectedSample)
  const records = Object.values(state.geneticsResearch.records)
  const unlocks = getSkillUnlocks('genetics')

  function runExtraction() {
    if (extractionLock.current) return
    extractionLock.current = true
    setResult(extractFromSample(selectedSampleId, target))
    extractionLock.current = false
  }

  return (
    <section className={`lab-interior lab-interior--tier-${current.id}`} aria-labelledby="lab-title">
      <header className="lab-heading"><div><span className="eyebrow">Physical research facility</span><h1 id="lab-title">Genetics Lab</h1></div><div><strong>{current.name} · Tier {current.id}</strong><span>Genetics Level {level}</span></div></header>

      <section className="lab-station lab-station--research" aria-labelledby="research-center-title"><header><span>Research Center</span><h2 id="research-center-title">Understand your collection</h2></header><div className="lab-station__summary"><strong>{records.length} clone lines studied</strong><span>{state.geneticsResearch.completedDiscoveryMilestoneIds.filter((id) => id.startsWith('feature:')).length} genetic features identified</span></div><ul className="lab-capabilities">{unlocks.filter((unlock) => unlock.level <= 50).map((unlock) => <li key={unlock.id}><strong>{unlock.name}</strong><span>{level >= unlock.level ? 'Unlocked' : `Genetics ${unlock.level}`}{unlock.level === 40 ? ` + ${getLabTierDefinition(TISSUE_SAMPLING_LAB_TIER).name}` : unlock.level === 50 ? ` + ${getLabTierDefinition(QUANTITATIVE_EXTRACTION_LAB_TIER).name}` : ''}</span></li>)}</ul><Link className="lab-station__action" to="/research">Open Research Log</Link></section>

      <section className="lab-station lab-station--microscope" aria-labelledby="microscope-title"><header><span>{state.geneticsLab.tier >= TISSUE_SAMPLING_LAB_TIER ? 'Available facility' : 'Locked facility'}</span><h2 id="microscope-title">Microscope Station</h2></header><p>Tissue collection begins from an owned Garden specimen. Requires Genetics {TISSUE_SAMPLING_LEVEL} and {getLabTierDefinition(TISSUE_SAMPLING_LAB_TIER).name}.</p><strong>{state.geneticsLab.tissueSamples.length} tissue samples</strong>{state.geneticsLab.tissueSamples.length ? <div className="lab-samples">{state.geneticsLab.tissueSamples.map((sample) => { const species = getSpeciesById(sample.donorSpeciesId); return <article key={sample.id}><span>{sample.qualityBand} quality · {sample.status}</span><h3>{species?.commonName ?? 'Unknown cactus'}</h3><em>{species?.scientificName}</em><dl><div><dt>Sample</dt><dd>{sample.id}</dd></div><div><dt>Clone line</dt><dd>{sample.donorCloneLineId}</dd></div><div><dt>Donor</dt><dd>{sample.donorSpecimenId}</dd></div><div><dt>Material</dt><dd>{sample.remainingUses} / {sample.initialUses} uses</dd></div></dl>{sample.status === 'stored' && <button type="button" aria-label={`Send sample ${sample.id} to Extraction Station`} onClick={() => { setSelectedSampleId(sample.id); setResult(null) }}>Send to Extraction Station</button>}</article> })}</div> : <p>No samples stored yet.</p>}</section>

      <section className="lab-station lab-station--extraction" aria-labelledby="extraction-station-title"><header><span>{state.geneticsLab.tier >= QUANTITATIVE_EXTRACTION_LAB_TIER ? 'Available facility' : 'Locked facility'}</span><h2 id="extraction-station-title">Extraction Station</h2></header><p>Quantitative extraction requires Genetics {QUANTITATIVE_EXTRACTION_LEVEL} and {getLabTierDefinition(QUANTITATIVE_EXTRACTION_LAB_TIER).name}.</p>{selectedSample && <div className="extraction-workflow"><h3>Selected sample</h3><p>{selectedSample.id} · {selectedSample.remainingUses}/{selectedSample.initialUses} uses</p><label>Quantitative target<select value={target} onChange={(event) => setTarget(event.target.value as QuantitativeExtractTarget)}>{quantitativeExtractTargets.map((id) => <option key={id} value={id}>{extractTargetLabels[id]}</option>)}</select></label><p>Every valid attempt consumes one use, including failure.</p><div><button type="button" disabled={!canExtract} onClick={runExtraction}>Attempt extraction</button><button type="button" onClick={() => setSelectedSampleId('')}>Clear sample</button></div>{result && <p role="status">{result.outcome === 'failure' ? 'Extraction failed; one material use was consumed.' : `${result.outcome === 'low-yield' ? 'Low yield' : 'Success'} · ${extractTargetLabels[result.target]} · quality ${result.extract?.extractionQuality} · potency ${result.extract?.potency}`}</p>}</div>}<h3>Stored Genetic Extracts · {state.geneticsLab.geneticExtracts.length}</h3>{state.geneticsLab.geneticExtracts.length ? <div className="lab-samples">{state.geneticsLab.geneticExtracts.map((extract) => <article key={extract.id}><span>{extract.outcome} · stored</span><h3>{extractTargetLabels[extract.target]}</h3><dl><div><dt>Extract</dt><dd>{extract.id}</dd></div><div><dt>Source</dt><dd>{extract.sourceTissueSampleId}</dd></div><div><dt>Clone line</dt><dd>{extract.donorCloneLineId}</dd></div><div><dt>Quality</dt><dd>{extract.extractionQuality}/100</dd></div><div><dt>Potency</dt><dd>{extract.potency}/100</dd></div></dl></article>)}</div> : <p>No genetic extracts stored.</p>}</section>

      <section className="lab-station lab-station--advanced" aria-labelledby="advanced-title"><header><span>Future facility</span><h2 id="advanced-title">Advanced Genetics</h2></header><ul className="lab-capabilities">{unlocks.filter((unlock) => unlock.level >= 60).map((unlock) => <li key={unlock.id}><strong>{unlock.name}</strong><span>{unlock.implemented && level >= unlock.level ? 'Unlocked' : `Future · Genetics ${unlock.level}`}</span></li>)}</ul></section>

      <section className="lab-station lab-station--upgrades" aria-labelledby="upgrades-title"><header><span>Facility progression</span><h2 id="upgrades-title">Facility Upgrades</h2></header><p>Current Facility: <strong>{current.name} · Tier {current.id}</strong></p>{next ? <div className="lab-upgrade"><div><span>Next upgrade</span><strong>{next.name} · Tier {next.id}</strong><small>{next.capabilities.join(', ')}</small></div><div><strong>{next.cost.toLocaleString()} Tokens</strong><button type="button" onClick={() => upgradeLab(next.id)} disabled={state.player.tokens < next.cost}>Install {next.name}</button>{state.player.tokens < next.cost && <small>Insufficient Tokens</small>}</div></div> : <p>Maximum facility tier reached.</p>}</section>
    </section>
  )
}
