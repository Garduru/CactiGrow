import { assertValidArea, type AreaDefinition } from '../../shared/realtime/areas.ts'
import { isSequence, type AreaId, type LayerId } from '../../shared/realtime/identifiers.ts'

export interface LayerPopulation {
  readonly areaId: AreaId
  readonly layerId: LayerId
  readonly createdAt: number
  readonly population: number
  readonly emptySince: number | null
}
export type LayerAssignment =
  | { readonly ok: true; readonly kind: 'existing'; readonly layerId: LayerId }
  | { readonly ok: true; readonly kind: 'create' }
  | { readonly ok: false; readonly code: 'AREA_FULL' }

export function isRetired(layer: LayerPopulation, area: AreaDefinition, now: number): boolean {
  return layer.population === 0 && layer.emptySince !== null && now - layer.emptySince >= area.emptyLayerRetentionMs
}

/** A decision only. The future single owner must serialize decision + membership insertion. */
export function assignLayer(area: AreaDefinition, layers: readonly LayerPopulation[], now: number, recentLayerId?: LayerId): LayerAssignment {
  assertValidArea(area)
  if (!isSequence(now)) throw new Error('Invalid assignment time.')
  const candidates = layers.filter((layer) => layer.areaId === area.areaId)
  const seen = new Set<LayerId>()
  for (const layer of candidates) {
    if (seen.has(layer.layerId) || !isSequence(layer.createdAt) || layer.createdAt > now
      || !isSequence(layer.population) || layer.population > area.layerCapacity
      || (layer.population === 0 ? !isSequence(layer.emptySince) || layer.emptySince < layer.createdAt || layer.emptySince > now : layer.emptySince !== null)) {
      throw new Error('Invalid Layer population state.')
    }
    seen.add(layer.layerId)
  }
  if (candidates.reduce((total, layer) => total + layer.population, 0) >= area.populationLimit) return { ok: false, code: 'AREA_FULL' }
  const eligible = candidates.filter((layer) => layer.population < area.layerCapacity && !isRetired(layer, area, now))
  const affinity = eligible.find((layer) => layer.layerId === recentLayerId)
  if (affinity) return { ok: true, kind: 'existing', layerId: affinity.layerId }
  const oldest = eligible.sort((a, b) => Number(b.population > 0) - Number(a.population > 0)
    || a.createdAt - b.createdAt || (a.layerId < b.layerId ? -1 : a.layerId > b.layerId ? 1 : 0))[0]
  return oldest ? { ok: true, kind: 'existing', layerId: oldest.layerId } : { ok: true, kind: 'create' }
}
