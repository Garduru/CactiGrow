import { useExploration } from './ExplorationContext'
import { useState } from 'react'
import { browserApiClient } from '../../services/api/browserApiClient'

export function ExplorationDevInspection({ enabled, recordAction }: { enabled: boolean; recordAction(label: string): void }) {
  const exploration = useExploration()
  const [inspection, setInspection] = useState('')
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
      <h3>Wild genetics</h3><p>Force only the next eligible harvest outcome. Ordinary seeds, proximity, tools, personal cooldowns and special-source lifetime limits remain enforced.</p>
      {(['normal', 'uncommon', 'rare'] as const).map(outcome => <button key={outcome} disabled={!enabled || exploration.pending} onClick={() => void exploration.reset('force-wild-outcome', outcome).then(ok => { if (ok) recordAction(`Next wild outcome: ${outcome}`) })}>Force {outcome}</button>)}
      <button disabled={!enabled || exploration.pending} onClick={() => void browserApiClient.inspectWildGenetics().then(value => setInspection(JSON.stringify(value, null, 2))).catch(() => setInspection('Wild genetics inspection unavailable.'))}>Inspect sources, lots and receipts</button>
      {inspection && <pre style={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inspection}</pre>}
    </>}
    {exploration.error && <p role="alert">{exploration.error}</p>}
  </details>
}
