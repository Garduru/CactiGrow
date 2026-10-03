import { useEffect, useRef, useState } from 'react'
import { getLevelFromXp } from '../progression/progressionModel'
import type { CollectedPlant } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { getNextResearchStep, projectGeneticKnowledge } from './researchModel'
import { GeneticKnowledgeView } from './GeneticKnowledgeView'
import { getTissueSamplingStatus } from '../lab/labModel'
import { TISSUE_SAMPLING_LAB_TIER, TISSUE_SAMPLING_LEVEL, getLabTierDefinition } from '../lab/labConfig'

interface ResearchWorkflowProps {
  plant: CollectedPlant
  onClose: () => void
}

export function ResearchWorkflow({ plant, onClose }: ResearchWorkflowProps) {
  const { state, observePlant, analyzePlant, collectTissueSample } = useGameState()
  const [sampleNotice, setSampleNotice] = useState('')
  const [researchBusy, setResearchBusy] = useState(false)
  const [researchNotice, setResearchNotice] = useState('')
  const researchPending = useRef(false)
  const [samplingNow, setSamplingNow] = useState(() => Date.now())
  const samplingRef = useRef(false)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const level = getLevelFromXp(state.player.skills.genetics.xp)
  const record = state.geneticsResearch.records[plant.cloneLineId]
  const knowledge = projectGeneticKnowledge(plant, record, level)
  const nextStep = getNextResearchStep(record)
  const canAdvance = !record || level >= nextStep.requiredLevel
  const samplingStatus = getTissueSamplingStatus(state.geneticsLab, level, plant.id, samplingNow)

  useEffect(() => {
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function advanceResearch() {
    if (researchPending.current) return
    researchPending.current = true; setResearchBusy(true); setResearchNotice('')
    try {
      const ok = record ? await analyzePlant(plant.id) : await observePlant(plant.id)
      setResearchNotice(ok ? 'Research updated.' : 'No research milestone is currently available. Check your Genetics level and collection status.')
    } catch (cause) { setResearchNotice(cause instanceof Error ? cause.message : 'Research could not be confirmed.') }
    finally { researchPending.current = false; setResearchBusy(false) }
  }

  async function samplePlant() {
    if (samplingRef.current) return
    samplingRef.current = true
    const sample = await collectTissueSample(plant.id)
    setSamplingNow(Date.now())
    setSampleNotice(sample ? `${sample.qualityBand} tissue sample stored.` : 'The specimen is not currently eligible for sampling.')
    samplingRef.current = false
  }

  return (
    <div className="plant-details-overlay">
      <button className="plant-details__backdrop" type="button" onClick={onClose} aria-label="Close Genetics research" />
      <section className="research-workflow" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="research-workflow-title">
        <header className="plant-details__header">
          <div>
            <span className="eyebrow">Genetics Level {level}</span>
            <h2 id="research-workflow-title">Study Genetics</h2>
            <em>{knowledge.scientificName ?? knowledge.speciesName ?? 'Unknown cactus'}</em>
          </div>
          <button className="plant-details__close" ref={closeRef} type="button" onClick={onClose} aria-label="Close Genetics research">&times;</button>
        </header>

        {record ? <GeneticKnowledgeView knowledge={knowledge} /> : (
          <div className="research-unstudied">
            <strong>This clone line has not been studied.</strong>
            <p>Observation records visible phenotype and identity. It does not reveal hidden carrier states.</p>
          </div>
        )}

        <footer className="research-workflow__actions">
          <div>
            <span>Next milestone</span>
            <strong>{nextStep.label}</strong>
            {level < nextStep.requiredLevel && <small>Requires Genetics Level {nextStep.requiredLevel}</small>}
          </div>
          {nextStep.label !== 'Research complete' && (
            <button className="nursery-button" type="button" onClick={() => void advanceResearch()} disabled={!canAdvance || researchBusy}>
              {researchBusy ? 'Researching…' : record ? 'Run analysis' : 'Observe specimen'}
            </button>
          )}
        </footer>
        {researchNotice && <p role="status">{researchNotice}</p>}
        <section className="research-sampling" aria-labelledby="sampling-title">
          <div><h3 id="sampling-title">Tissue Sampling</h3><p>Creates a provenance-preserving research sample without changing or consuming the plant.</p></div>
          <ul>
            <li>{level >= TISSUE_SAMPLING_LEVEL ? 'Genetics Level requirement met' : `Requires Genetics Level ${TISSUE_SAMPLING_LEVEL}`}</li>
            <li>{state.geneticsLab.tier >= TISSUE_SAMPLING_LAB_TIER ? 'Microscope Station requirement met' : `Requires ${getLabTierDefinition(TISSUE_SAMPLING_LAB_TIER).name}`}</li>
            {samplingStatus.cooldownUntil && <li>Recently sampled · available {new Date(samplingStatus.cooldownUntil).toLocaleString()}</li>}
          </ul>
          <button className="nursery-button" type="button" onClick={samplePlant} disabled={!samplingStatus.available}>Collect Tissue Sample</button>
          {sampleNotice && <p role="status">{sampleNotice}</p>}
        </section>
      </section>
    </div>
  )
}
