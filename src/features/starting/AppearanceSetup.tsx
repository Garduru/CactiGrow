import { useState } from 'react'
import { SHIRT_COLORS, SKIN_COLORS } from '../../../shared/api/startingExperienceV1.ts'
import { useStartingExperience } from './StartingContext'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
export function AppearanceSetup() {
  const tutorial = useStartingExperience(), [skin, setSkin] = useState(0), [shirt, setShirt] = useState(0)
  const world = useWorldLocation()
  return <main className="deployment-access-state appearance-setup"><h1>Make yourself at home</h1><p>Choose a look for your desert adventure.</p>
    <svg viewBox="0 0 100 140" width="100" height="140" role="img" aria-label="Character preview"><rect x="33" y="61" width="34" height="62" fill={`#${SHIRT_COLORS[shirt].toString(16)}`} stroke="#2b1a13" strokeWidth="4"/><circle cx="50" cy="49" r="20" fill={`#${SKIN_COLORS[skin].toString(16)}`} stroke="#2b1a13" strokeWidth="4"/></svg>
    <fieldset><legend>Skin</legend>{SKIN_COLORS.map((_, i) => <button type="button" key={i} aria-pressed={skin === i} onClick={() => setSkin(i)}>Tone {i + 1}</button>)}</fieldset>
    <fieldset><legend>Shirt</legend>{['Terracotta','Sage','Slate'].map((label, i) => <button type="button" key={label} aria-pressed={shirt === i} onClick={() => setShirt(i)}>{label}</button>)}</fieldset>
    {tutorial.error && <p role="alert">{tutorial.error}</p>}<button disabled={tutorial.pending} onClick={() => { void tutorial.execute({ type: 'save-appearance', appearance: { skin, shirt } }).then(ok => { if(ok)world.reload() }) }}>{tutorial.pending ? 'Saving…' : 'Begin your adventure'}</button>
  </main>
}
