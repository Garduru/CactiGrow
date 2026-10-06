import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStartingExperience } from './StartingContext'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { createFarmReturnState } from '../../app/farmReturnNavigation'
import { useFeaturePanel } from '../menu/featurePanelState'
const spawnObjectives = { appearance: 'Choose your appearance.', 'meet-guide': 'Talk to Mara beside the Starting Spawn path.', 'equip-tool': 'Equip your Field Knife in Inventory.', 'harvest-cactus': 'Tap the wild San Pedro near Mara to harvest seeds.', 'plant-pot': 'Follow the eastern road to Path 1. Plant the tutorial pot.', 'collect-pot': 'Return to the Path 1 pot when your plant is ready.', 'leave-zone': 'Take the eastern Path 1 opening to Cross Path.', complete: 'Explore Cross Path. Your own Farm is through the northern opening.' }
const farmObjectives = { undiscovered: 'Discover your Farm through the northern Cross Path opening.', nursery: 'Plant a normal seed in your real Nursery. Growth continues offline.', garden: 'Open Collection in your Garden. Favorite your tutorial specimen.', research: 'Visit the Genetics Lab and observe your tutorial specimen.', breeding: 'Choose the two practice parents and breed one offspring.', complete: 'Your Farm is ready. Keep exploring, collecting, and growing.' }
export function StartingObjective() {
  const tutorial = useStartingExperience(), world = useWorldLocation(), lifecycle = usePlantLifecycle(), grower = useGrowerAuthority(), panels = useFeaturePanel(), navigate = useNavigate(), route = useLocation()
  const [expanded, setExpanded] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [parentA, setParentA] = useState(''), [parentB, setParentB] = useState('')
  const s = tutorial.state
  if (!tutorial.active || !s || s.compatibilityComplete || s.farmTutorialComplete) return null
  const farm = s.spawnTutorialComplete && s.farmStage !== 'undiscovered', objective = farm ? farmObjectives[s.farmStage] : spawnObjectives[s.spawnStage]
  const open = (id: 'nursery' | 'garden' | 'lab', path = `/${id}`) => navigate(path, { state: { ...createFarmReturnState(id), worldReturnTo: '/world', worldRevision: world.location?.revision } })
  async function research() {
    setBusy(true); setMessage('')
    try {
      const result = await grower.mutate({ type: 'observe-specimen', specimenId: s!.tutorialParentIds[0] })
      if (!result) setMessage('The observation was unavailable. Refresh the specimen and try again.')
      await tutorial.refresh()
    } finally { setBusy(false) }
  }
  async function breed() {
    setBusy(true); setMessage('')
    try {
      const seed = await lifecycle.breed(parentA,parentB)
      if (!seed) setMessage('Breeding was unavailable. Refresh your parents and try again.')
      await tutorial.refresh(); await grower.refresh()
    } finally { setBusy(false) }
  }
  return <aside className="starting-objective" aria-label="Current tutorial objective"><button className="starting-objective__toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{farm ? 'Your first Farm' : 'First steps'} {expanded ? '−' : '+'}</button>
    {expanded && <div><p>{objective}</p>
      {s.spawnStage === 'equip-tool' && <button onClick={() => panels.openFeature('inventory')}>Open Inventory</button>}
      {farm && s.farmStage === 'nursery' && <><button onClick={() => open('nursery')}>Visit Nursery</button><button disabled={tutorial.pending} onClick={() => { void tutorial.execute({ type:'confirm-nursery' }) }}>I planted a normal seed</button><small>Farm plants keep their normal schedule. The Path 1 pot’s quick growth was a tutorial lesson.</small></>}
      {farm && s.farmStage === 'garden' && <><button onClick={() => open('garden')}>Open Garden / Collection</button><p>Your San Pedro has its own identity: {s.tutorialParentIds[0].slice(0,8)}. Favorite it in Collection to learn protection.</p><button disabled={tutorial.pending} onClick={() => { void tutorial.execute({ type:'confirm-garden' }).then(ok => { if(ok) void lifecycle.refresh() }) }}>I favorited my tutorial plant</button></>}
      {farm && s.farmStage === 'research' && <><p>Genetics belong to the specimen. Research knowledge belongs to you. Start by recording visible facts.</p><button onClick={() => open('lab')}>Visit Genetics Lab</button>{route.pathname === '/lab' && <button disabled={busy} onClick={() => { void research() }}>Observe tutorial specimen</button>}</>}
      {farm && s.farmStage === 'breeding' && <><button onClick={() => open('garden','/breeding')}>Visit Breeding</button>{route.pathname === '/breeding' && <><p>Both parents are mature San Pedro practice specimens. The real breeding system resolves inheritance from both.</p><label>Parent A<select aria-label="Parent A" value={parentA} onChange={e => setParentA(e.target.value)}><option value="" disabled>Choose Parent A</option><option value={s.tutorialParentIds[0]}>Tutorial San Pedro · {s.tutorialParentIds[0].slice(0,8)}</option></select></label><label>Parent B<select aria-label="Parent B" value={parentB} onChange={e => setParentB(e.target.value)}><option value="" disabled>Choose Parent B</option><option value={s.tutorialParentIds[1]}>Practice San Pedro · {s.tutorialParentIds[1].slice(0,8)}</option></select></label><button disabled={busy || !parentA || !parentB} onClick={() => { void breed() }}>Breed practice offspring</button></>}</>}
      {(tutorial.error || message) && <p role="alert">{tutorial.error || message}</p>}
    </div>}
  </aside>
}
