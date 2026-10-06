import { useStartingExperience } from './StartingContext'
export function StartingDevInspection() {
  const tutorial = useStartingExperience()
  if (!tutorial.active || !tutorial.state) return null
  const s = tutorial.state
  return <details className="dev-tools__card"><summary>Starting Experience inspection</summary><dl><div><dt>Compatibility complete</dt><dd>{String(s.compatibilityComplete)}</dd></div><div><dt>Appearance</dt><dd>{s.appearance.skin} / {s.appearance.shirt}</dd></div><div><dt>Spawn objective</dt><dd>{s.spawnStage}</dd></div><div><dt>Farm objective</dt><dd>{s.farmStage}</dd></div><div><dt>Tool</dt><dd>{s.equipment.tool ?? 'Empty'}</dd></div><div><dt>Harvesting XP</dt><dd>{s.harvestingXp}</dd></div><div><dt>Pot schedule</dt><dd>{s.pot?.readyAt ?? 'Not planted'}</dd></div></dl><button onClick={() => { void tutorial.refresh() }}>Refresh tutorial inspection</button><p>Read-only. No account reset, XP grant, or repeat tutorial rewards.</p></details>
}
