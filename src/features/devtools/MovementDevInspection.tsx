import { useEffect, useState } from 'react'
import { getMovementDiagnostics } from './movementDiagnostics.ts'
import { browserApiClient } from '../../services/api/browserApiClient.ts'
import { WORLD, findArea } from '../../../shared/world/world.ts'
export function MovementDevInspection() {
  const [, setVersion] = useState(0), [result, setResult] = useState('')
  useEffect(() => { const timer = setInterval(() => setVersion(v => v + 1), 1000); return () => clearInterval(timer) }, [])
  const movement = getMovementDiagnostics(), authority = movement?.authority
  async function invalidCheckpoint() {
    if (!authority) return
    const response = await browserApiClient.movementCheckpoint({ v: 1, expectedWorldRevision: authority.worldRevision, runtimeAreaId: authority.runtimeAreaId, position: { x: -10000, y: -10000 } })
    // Inspect the rejection without injecting a local teleport or replacing a valid route.
    setResult(response.accepted ? 'Unexpected acceptance.' : `Rejected: ${response.lastRejection}; accepted ${response.position.x}, ${response.position.y}.`)
  }
  async function probe(kind: 'area' | 'teleport' | 'harvest' | 'npc') {
    if (!authority) return
    const area = findArea(authority.areaId)!
    if (kind === 'area' || kind === 'teleport') {
      const points = [...area.spawns, ...(area.interactables ?? [])].map(s => ({ x: s.x, y: s.y }))
      const farthest = points.sort((a, b) => Math.hypot(b.x - authority.position.x, b.y - authority.position.y) - Math.hypot(a.x - authority.position.x, a.y - authority.position.y))[0]
      if (kind === 'teleport' && Math.hypot(farthest.x - authority.position.x, farthest.y - authority.position.y) < 600) throw new Error('Walk farther from an Area spawn before this teleport probe.')
      const response = await browserApiClient.movementCheckpoint({ v: 1, expectedWorldRevision: authority.worldRevision, runtimeAreaId: kind === 'area' ? WORLD.areas.find(a => a.areaId !== area.areaId)!.areaId : authority.runtimeAreaId, position: kind === 'teleport' ? farthest : authority.position })
      setResult(response.accepted ? 'Unexpected acceptance.' : `Rejected: ${response.lastRejection}; accepted ${response.position.x}, ${response.position.y}.`)
      return
    }
    const entity = area.interactables?.find(e => (kind === 'harvest' ? !!e.resourceType : e.kind === 'npc') && Math.hypot(e.x - authority.position.x, e.y - authority.position.y) > 120)
    if (!entity) throw new Error(`No remote ${kind} target in this Area. Use Cross Path for harvest or Town for NPC.`)
    // Targets are deliberately outside accepted reach. No reset, tool grant or reward shortcut.
    if (kind === 'harvest') await browserApiClient.explorationCommand({ v: 1, commandId: crypto.randomUUID(), type: 'harvest', entityId: entity.entityId, expectedWorldRevision: authority.worldRevision, position: { x: entity.x, y: entity.y } })
    else await browserApiClient.worldInteraction(entity.entityId)
    setResult('Unexpected acceptance.')
  }
  const run = (action: () => Promise<void>) => void action().catch(e => setResult(e instanceof Error ? `Rejected/unavailable: ${e.message}` : 'Unavailable'))
  return <details><summary>Movement authority</summary><pre>{JSON.stringify({ ...authority, clientServerDelta: movement?.delta, realtime: movement?.realtimeStatus, realtimeDiagnostic: movement?.realtimeDiagnostic, error: movement?.error }, null, 2)}</pre><button disabled={!authority} onClick={() => run(invalidCheckpoint)}>Test invalid checkpoint safely</button><button disabled={!authority} onClick={() => run(() => probe('teleport'))}>Test remote teleport</button><button disabled={!authority} onClick={() => run(() => probe('area'))}>Test fabricated Area switch</button><button disabled={!authority} onClick={() => run(() => probe('harvest'))}>Test remote harvest</button><button disabled={!authority} onClick={() => run(() => probe('npc'))}>Test remote NPC</button>{result && <p role="status">{result}</p>}</details>
}
