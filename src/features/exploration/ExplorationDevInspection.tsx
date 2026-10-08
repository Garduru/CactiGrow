import { useExploration } from './ExplorationContext'

export function ExplorationDevInspection({ enabled, recordAction }: { enabled: boolean; recordAction(label: string): void }) {
  const exploration = useExploration()
  if (!exploration.active) return null
  const projection = exploration.projection
  const reset = async (type: 'reset-landmarks' | 'reset-cooldowns') => { if (await exploration.reset(type)) recordAction(type === 'reset-landmarks' ? 'Reset own First Basin landmarks' : 'Reset own wild resource cooldowns') }
  return <details className="dev-tools__card"><summary>First Basin exploration</summary>
    <p>Only your own First Basin discovery or cooldown state changes. Harvest rewards and XP remain intact.</p>
    <button disabled={exploration.pending} onClick={() => void exploration.refresh()}>Refresh exploration inspection</button>
    {projection && <><dl className="dev-tools__facts"><div><dt>Revision</dt><dd>{projection.revision}</dd></div><div><dt>Harvesting XP</dt><dd>{projection.harvestingXp}</dd></div></dl>
      <h3>Landmarks</h3><ul>{projection.landmarks.map(record => <li key={record.landmarkId}>{record.landmarkId} · {record.discoveredAt ?? 'Undiscovered'}</li>)}</ul>
      <h3>Wild resources</h3><ul>{projection.nodes.map(node => <li key={node.entityId}>{node.entityId} · {node.readyAt && Date.parse(node.readyAt) > exploration.now() ? `Regrows ${node.readyAt}` : 'Available'}</li>)}</ul>
      <button disabled={!enabled || exploration.pending} onClick={() => void reset('reset-landmarks')}>Reset own First Basin landmark discoveries</button>
      <button disabled={!enabled || exploration.pending} onClick={() => void reset('reset-cooldowns')}>Reset own wild resource cooldowns</button>
    </>}
    {exploration.error && <p role="alert">{exploration.error}</p>}
  </details>
}
