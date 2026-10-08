import { useTutorialGuidance } from './TutorialGuidanceContext'
import { useEffect, useState } from 'react'
import { useStartingExperience } from './StartingContext'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { useGardenAuthority } from '../../app/useGardenAuthority'
export function StartingObjective() {
  const tutorial = useStartingExperience(), lifecycle = usePlantLifecycle(), grower = useGrowerAuthority(), garden = useGardenAuthority()
  const guidance = useTutorialGuidance()
  const [expanded, setExpanded] = useState(true)
  const s = tutorial.state, active = tutorial.active && !!s && !s.compatibilityComplete && !s.farmTutorialComplete
  const lifecycleVersion = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection.lifecycleVersion : null
  const growerVersion = grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection.version : null
  const refresh = tutorial.refresh, refreshLifecycle = lifecycle.refresh
  // Coalesce committed domain projection changes; no polling or client completion claims.
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => void refresh(), 100)
    return () => window.clearTimeout(timer)
  }, [active, lifecycleVersion, growerVersion, garden.projection, refresh])
  const practiceParent = s?.tutorialParentIds[1]
  useEffect(() => { if (active && practiceParent) void refreshLifecycle() }, [active, practiceParent, refreshLifecycle])
  if (!active || !s) return null
  const steps = s.spawnTutorialComplete ? ['nursery','garden','lab','research','breeding'] : ['meet-guide','equip-tool','harvest-cactus','plant-pot','collect-pot','collect-ready','leave-zone']
  const step = Math.max(0, steps.indexOf(s.spawnTutorialComplete ? s.farmStage : s.spawnStage)) + 1
  return <aside className="starting-objective" aria-label="Current tutorial objective"><button className="starting-objective__toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{s.spawnTutorialComplete ? 'Your first Farm' : 'First steps'} {expanded ? '-' : '+'}</button>
    {expanded && <div><span className="starting-objective__step">Step {step} of {steps.length}</span><p aria-live="polite">{guidance.instruction}</p>{tutorial.error && <p role="alert">{tutorial.error}</p>}</div>}
  </aside>
}
