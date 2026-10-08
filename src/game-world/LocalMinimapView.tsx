import { useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { worldInputBoundary } from '../components/layout/worldInputBoundary'
import { useLocalMinimap } from './LocalMinimapContext'
import { minimapPoint, minimapSurfaces, type LocalMinimapStore } from './localMinimap'
import './localMinimap.css'
export function LocalMinimap({ areaId, hidden }: { areaId: string; hidden: boolean }) {
  const map = useLocalMinimap()
  return map?.open && !hidden ? <MinimapView key={areaId} store={map.store} areaId={areaId} close={map.toggle} /> : null
}
function MinimapView({ store, areaId, close }: { store: LocalMinimapStore; areaId: string; close(): void }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot), [message, setMessage] = useState('')
  const areaForSurfaces = snapshot?.area
  const surfaces = useMemo(() => areaForSurfaces ? minimapSurfaces(areaForSurfaces) : [], [areaForSurfaces])
  if (!snapshot || snapshot.area.areaId !== areaId) return null
  const { area, player, blocked } = snapshot
  function click(event: MouseEvent<SVGSVGElement>) {
    event.stopPropagation()
    const svg = event.currentTarget, transform = svg.getScreenCTM()
    const cursor = svg.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY
    const local = transform ? cursor.matrixTransform(transform.inverse()) : null
    const point = local ? minimapPoint(local.x, local.y, area.width, area.height, area) : null
    setMessage(point && store.walk(point) ? '' : 'That point cannot be reached.')
  }
  const radius = Math.max(area.width, area.height) / 95
  return <aside {...worldInputBoundary} onPointerDown={event => event.stopPropagation()} className="local-minimap" aria-label="Local minimap" data-area-id={areaId}>
    <header><strong>{area.displayName}</strong><span aria-label="North">N ↑</span><button type="button" onClick={close} aria-label="Close Map">×</button></header>
    <svg role="img" aria-label={`${area.displayName} navigation map. Click or tap to walk.`} viewBox={`0 0 ${area.width} ${area.height}`} style={{ aspectRatio: `${area.width}/${area.height}` }} onClick={click}>
      <rect width={area.width} height={area.height} className="local-minimap__ground" />
      {surfaces.map((surface, index) => <rect key={`${surface.layer}:${index}`} x={surface.x} y={surface.y} width={surface.width} height={surface.height} className={`local-minimap__surface local-minimap__surface--${surface.layer}`} data-minimap-layer={surface.layer} />)}
      {blocked.map((rect, index) => <rect key={index} x={rect.left} y={rect.top} width={rect.right-rect.left} height={rect.bottom-rect.top} className="local-minimap__blocked" />)}
      {area.exits.map(exit => <rect key={exit.exitId} x={exit.x-exit.width/2} y={exit.y-exit.height/2} width={exit.width} height={exit.height} className={exit.blocked ? 'local-minimap__future' : 'local-minimap__exit'}><title>{exit.futureDestinationLabel ?? exit.targetAreaId ?? 'Exit'}</title></rect>)}
      <circle cx={player.x} cy={player.y} r={radius} className="local-minimap__player" data-player-x={player.x} data-player-y={player.y} />
    </svg>
    <p role="status">{message || 'Tap the map to walk'}</p>
  </aside>
}
