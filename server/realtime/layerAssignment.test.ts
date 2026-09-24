import assert from 'node:assert/strict'
import test from 'node:test'
import { TOWN_AREA, type AreaDefinition } from '../../shared/realtime/areas.ts'
import { areaId, layerId } from '../../shared/realtime/identifiers.ts'
import { assignLayer, type LayerPopulation } from './layerAssignment.ts'

const area: AreaDefinition = { ...TOWN_AREA, layerCapacity: 2, populationLimit: 5, emptyLayerRetentionMs: 30 }
const id = (n: number) => layerId(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const layer = (n: number, population: number, createdAt = n): LayerPopulation => ({ areaId: area.areaId, layerId: id(n), population, createdAt, emptySince: population === 0 ? createdAt : null })

test('An empty Area requests a new opaque Layer identity from its owner', () => {
  assert.deepEqual(assignLayer(area, [], 10), { ok: true, kind: 'create' })
})
test('An occupied Layer takes the next player before an older retained empty Layer', () => {
  assert.deepEqual(assignLayer(area, [layer(1, 0), layer(2, 1)], 10), { ok: true, kind: 'existing', layerId: id(2) })
})
test('The oldest eligible occupied Layer wins regardless of input order', () => {
  const layers = [layer(3, 1), layer(1, 2), layer(2, 1)]
  assert.deepEqual(assignLayer(area, layers, 10), { ok: true, kind: 'existing', layerId: id(2) })
  assert.deepEqual(assignLayer(area, [...layers].reverse(), 10), assignLayer(area, layers, 10))
  assert.equal(layers[0].layerId, id(3))
})
test('Equal-age Layers have deterministic opaque-ID tie breaking', () => {
  assert.deepEqual(assignLayer(area, [layer(2, 1, 1), layer(1, 1, 1)], 10), { ok: true, kind: 'existing', layerId: id(1) })
})
test('Full Layers are skipped and another Layer can be created', () => {
  assert.deepEqual(assignLayer(area, [layer(1, 2), layer(2, 2)], 10), { ok: true, kind: 'create' })
})
test('Area limit wins even when a Layer has space or affinity matches', () => {
  const layers = [layer(1, 2), layer(2, 2), layer(3, 1)]
  assert.deepEqual(assignLayer(area, layers, 10, id(3)), { ok: false, code: 'AREA_FULL' })
  assert.deepEqual(assignLayer({ ...area, populationLimit: 1 }, [layer(1, 1)], 10), { ok: false, code: 'AREA_FULL' })
})
test('Eligible affinity takes priority, including a retained empty Layer', () => {
  assert.deepEqual(assignLayer(area, [layer(1, 1), layer(2, 1)], 10, id(2)), { ok: true, kind: 'existing', layerId: id(2) })
  assert.deepEqual(assignLayer(area, [layer(1, 1), layer(2, 0)], 10, id(2)), { ok: true, kind: 'existing', layerId: id(2) })
})
test('Full, missing, and retired affinity fall back without exceeding capacity', () => {
  for (const [layers, affinity] of [[ [layer(1, 1), layer(2, 2)], id(2) ], [ [layer(1, 1)], id(9) ], [ [layer(1, 1), layer(2, 0)], id(2) ]] as const) {
    assert.deepEqual(assignLayer(area, layers, 32, affinity), { ok: true, kind: 'existing', layerId: id(1) })
  }
})
test('Retained empty Layers are reused only before the exact retirement boundary', () => {
  assert.deepEqual(assignLayer(area, [layer(1, 0)], 30), { ok: true, kind: 'existing', layerId: id(1) })
  assert.deepEqual(assignLayer(area, [layer(1, 0)], 31), { ok: true, kind: 'create' })
})
test('Assignment is generic and ignores foreign Area population and affinity', () => {
  const other = { ...area, areaId: areaId('test-area') }
  const foreign = layer(1, 2)
  assert.deepEqual(assignLayer(other, [foreign], 10, foreign.layerId), { ok: true, kind: 'create' })
  const own = { ...layer(2, 1), areaId: other.areaId }
  assert.deepEqual(assignLayer(other, [foreign, own], 10), { ok: true, kind: 'existing', layerId: own.layerId })
})
test('Invalid owner population snapshots fail rather than silently bypassing limits', () => {
  for (const layers of [[layer(1, 3)], [layer(1, -1)], [layer(1, 1), layer(1, 1)], [{ ...layer(1, 0), emptySince: null }], [layer(20, 1)]]) {
    assert.throws(() => assignLayer(area, layers, 10), /Invalid Layer/)
  }
  assert.throws(() => assignLayer(area, [], -1), /Invalid assignment time/)
})
