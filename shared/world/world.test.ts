import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseWorld, topologyToRuntime } from '../../scripts/world-import.ts'
import { WORLD, authoredRoadExit, discoveredTravelAreas, findArea, initialLocation, runtimeAreaId, isWorldLocation } from './world.ts'
import { resolveExit, resolveTravel } from '../../server/world/WorldService.ts'
import { getChatLocation, sharesChatScope } from '../realtime/chatLocation.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { AreaExitController, insideExit } from '../../src/game-world/AreaExitController.ts'
const source = () => JSON.parse(readFileSync('world/cactigrow-world.ldtk', 'utf8'))
const owner = '00000000-0000-4000-8000-000000000001'

test('Travel requires physical discovery, uses authored entries and owner identity, and never unlocks paths', () => {
  let location = initialLocation(owner)
  const travel = (travelDestinationId: string) => resolveTravel(location, { v: 1, travelDestinationId, expectedRevision: location.revision, commandId: owner }, owner)
  assert.deepEqual(discoveredTravelAreas(location), [])
  assert.throws(() => travel('town-p1'))
  assert.throws(() => travel('player-farm'))
  for (const exitId of ['to-path-1', 'to-cross-path-1', 'to-player-farm', 'to-cross-path-1']) location = resolveExit(location, { v: 1, exitId, expectedRevision: location.revision, commandId: owner }, owner)
  assert.deepEqual(discoveredTravelAreas(location).map(a => a.areaId), ['player-farm'])
  assert.throws(() => travel('town-p1'))
  const home = travel('player-farm')
  assert.equal(home.runtimeAreaId, `farm-${owner}`); assert.equal(home.entryId, findArea('player-farm')!.travelSpawnId)
  assert.deepEqual(home.discoveredTravelDestinationIds, location.discoveredTravelDestinationIds)
  assert.throws(() => travel('path-2'))
  for (const exitId of ['to-path-2', 'to-town-p1', 'to-path-2']) location = resolveExit(location, { v: 1, exitId, expectedRevision: location.revision, commandId: owner }, owner)
  assert.deepEqual(new Set(discoveredTravelAreas(location).map(a => a.areaId)), new Set(['player-farm','town-p1']))
  const town = travel('town-p1'); assert.equal(town.entryId, findArea('town-p1')!.travelSpawnId)
  assert.throws(() => resolveTravel(town, { v: 1, travelDestinationId: 'town-p1', expectedRevision: town.revision, commandId: owner }, owner))
  const fake = { ...initialLocation(owner), discoveredTravelDestinationIds: ['town-p1'] }
  assert.throws(() => resolveTravel(fake, { v: 1, travelDestinationId: 'town-p1', expectedRevision: 0, commandId: owner }, owner))
})

test('spawn and Travel metadata are authorable without transition code patches', () => {
  const p = source(), level = p.levels.find((l: {identifier:string}) => l.identifier === 'Cross_Path_1')
  const entry = level.layerInstances.flatMap((l: {entityInstances:unknown[]}) => l.entityInstances).find((e: {__identifier:string;fieldInstances:{__identifier:string;__value:string}[]}) => e.__identifier === 'AreaSpawn' && e.fieldInstances.some(f => f.__identifier === 'entryId' && f.__value === 'from-player-farm'))
  entry.px = [128, 104]
  assert.deepEqual(parseWorld(p).areas.find(a => a.areaId === 'cross-path-1')!.spawns.find(s => s.entryId === 'from-player-farm'), {entryId:'from-player-farm',x:640,y:520})
  const town = p.levels.find((l: {identifier:string}) => l.identifier === 'Town_p1')
  town.fieldInstances.find((f: {__identifier:string}) => f.__identifier === 'travelSpawnId').__value = 'missing'
  assert.throws(() => parseWorld(p), /Travel spawn/)
})

test('Farm/Town physical roads use LDtk neighbours and exact authored entries, never a direct shortcut', () => {
  const cases = [
    ['player-farm', 'to-cross-path-1', 'cross-path-1', 'from-player-farm', 640, 440],
    ['cross-path-1', 'to-player-farm', 'player-farm', 'from-cross-path-1', 1500, 1660],
    ['town-p1', 'to-path-2', 'path-2', 'from-town-p1', 2280, 440],
    ['path-2', 'to-town-p1', 'town-p1', 'from-path-2', 1100, 1280],
  ] as const
  for (const [source, exitId, target, entryId, x, y] of cases) {
    const area = findArea(source)!, spawn = area.spawns.find(s => s.entryId === 'default')!
    const current = { ...initialLocation(owner), areaId: source, runtimeAreaId: runtimeAreaId(area, owner), zoneId: area.zoneId, entryId: spawn.entryId, position: { x: spawn.x, y: spawn.y } }
    const next = resolveExit(current, { v: 1, exitId, expectedRevision: 0, commandId: owner }, owner)
    assert.equal(next.areaId, target); assert.equal(next.entryId, entryId); assert.deepEqual(next.position, { x, y })
    const beforeChat = getChatLocation(current.runtimeAreaId)!, afterChat = getChatLocation(next.runtimeAreaId)!
    assert.equal(afterChat.areaId, runtimeAreaId(findArea(target)!, owner)); assert.equal(afterChat.zoneId, 'first-basin')
    assert.equal(sharesChatScope('local', beforeChat, afterChat), false); assert.equal(sharesChatScope('world', beforeChat, afterChat), true)
    if (area.areaType === 'farm' || area.areaType === 'town') {
      assert.equal(authoredRoadExit(area)!.exitId, exitId)
      const forbidden = area.areaType === 'farm' ? 'town-p1' : 'player-farm'
      assert.equal(area.exits.some(e => e.targetAreaId === forbidden), false)
      assert.throws(() => resolveExit(current, { v: 1, exitId: `to-${forbidden}`, expectedRevision: 0, commandId: owner }, owner))
      const redirected = { ...area, exits: [{ ...area.exits[0], exitId: 'authored-renamed-road' }] }
      assert.equal(authoredRoadExit(redirected)!.exitId, 'authored-renamed-road', 'interaction follows authored data rather than a parallel exit table')
      assert.throws(() => authoredRoadExit({ ...area, exits: [] }), /one authored road/)
    }
  }
})
test('location projection validation fails safely on malformed runtime identities and positions', () => {
  const s = initialLocation(owner)
  assert.equal(isWorldLocation(s), true)
  for (const patch of [{ runtimeAreaId: undefined }, { runtimeAreaId: 1 }, { position: { x: NaN, y: 10 } }, { areaId: 'missing' }, { zoneId: 'missing' }]) assert.equal(isWorldLocation({ ...s, ...patch }), false)
})
test('LDtk parses, preserves actual identifiers, unique stable IDs, dimensions and Zone membership', () => {
  const world = parseWorld(source())
  assert.equal(world.areas.length, 11)
  assert.equal(new Set(world.areas.map(a => a.areaId)).size, 11)
  assert.equal(findArea('starting-spawn-tutorial')!.identifier, 'Starting_Spawn_Tutorial_1')
  assert.equal(findArea('path-1')!.zoneId, 'starting-zone')
  for (const id of ['cross-path-1', 'player-farm', 'town-p1']) assert.equal(findArea(id)!.zoneId, 'first-basin')
  assert.equal(findArea('player-farm')!.width, 3000); assert.equal(findArea('player-farm')!.height, 1900)
  assert.equal(findArea('player-farm')!.topology.width, 576)
  assert.equal(findArea('town-p1')!.width, 2200); assert.equal(findArea('town-p1')!.height, 1500)
  assert.equal(findArea('town-p1')!.topology.width, 432)
  assert.equal(findArea('path-3')!.height, 2400)
})
test('invalid Zones, duplicate IDs, orphan references and out-of-bounds spawns fail import', () => {
  const mutations = [
    (p: ReturnType<typeof source>) => { p.levels[0].fieldInstances.find((f: {__identifier: string}) => f.__identifier === 'zoneId').__value = 'fake-zone' },
    (p: ReturnType<typeof source>) => { p.levels[1].fieldInstances.find((f: {__identifier: string}) => f.__identifier === 'areaId').__value = 'player-farm' },
    (p: ReturnType<typeof source>) => { p.levels[0].layerInstances[0].entityInstances.find((e: {__identifier: string}) => e.__identifier === 'AreaExit').fieldInstances.find((f: {__identifier: string}) => f.__identifier === 'targetEntry').__value.levelIid = 'missing' },
    (p: ReturnType<typeof source>) => { p.levels[1].layerInstances[0].entityInstances[0].px = [-1, 128] },
  ]
  for (const mutate of mutations) { const p = source(); mutate(p); assert.throws(() => parseWorld(p)) }
})
test('valid exit changes Zone, resolves EntityRef spawn, preserves identity/discovery and rejects forged/stale transitions', () => {
  let location = initialLocation(owner)
  const step = (exitId: string) => { location = resolveExit(location, { v: 1, exitId, expectedRevision: location.revision, commandId: owner }, owner) }
  step('to-path-1'); assert.equal(location.zoneId, 'starting-zone')
  step('to-cross-path-1'); assert.equal(location.zoneId, 'first-basin'); assert.equal(location.entryId, 'from-path-1')
  const spawn = findArea('cross-path-1')!.spawns.find(s => s.entryId === location.entryId)!
  assert.deepEqual(location.position, { x: spawn.x, y: spawn.y })
  step('to-player-farm'); assert.equal(location.runtimeAreaId, `farm-${owner}`)
  assert.deepEqual(location.discoveredTravelDestinationIds, ['player-farm'])
  assert.throws(() => step('to-the-first-basin'))
  assert.throws(() => resolveExit(location, { v: 1, exitId: 'to-cross-path-1', expectedRevision: 0, commandId: owner }, owner))
})
test('blocked future exit cannot transition or discover future content', () => {
  let location = initialLocation(owner)
  for (const exitId of ['to-path-1','to-cross-path-1','to-path-3','to-path-5-under-construction']) location = resolveExit(location, { v: 1, exitId, expectedRevision: location.revision, commandId: owner }, owner)
  assert.throws(() => resolveExit(location, { v: 1, exitId: 'future-route', expectedRevision: location.revision, commandId: owner }, owner), /under construction/)
  assert.equal(WORLD.areas.some(a => /verdara|glass/.test(a.areaId)), false)
})
test('authored chat scopes preserve private Farm isolation, Town membership and Zone boundary', () => {
  const farm = getChatLocation(runtimeAreaId(findArea('player-farm')!, owner))!, other = getChatLocation('farm-00000000-0000-4000-8000-000000000002')!
  const town = getChatLocation('town')!, path = getChatLocation('path-1')!, cross = getChatLocation('cross-path-1')!
  assert.equal(sharesChatScope('local', farm, other), false)
  assert.equal(sharesChatScope('world', farm, town), true)
  assert.equal(sharesChatScope('world', path, cross), false)
  assert.equal(sharesChatScope('town', town, town), true)
  assert.equal(sharesChatScope('town', cross, town), false)
})
test('existing route planner reaches every rough Area entry/exit without changing authored collision', () => {
  for (const a of WORLD.areas.filter(a => a.areaType !== 'farm' && a.areaType !== 'town')) {
    const map = new NavigationMap(a.width, a.height, a.collision), start = a.spawns.find(s => s.entryId === 'default')!
    for (const end of [...a.spawns, ...a.exits]) { assert.equal(map.walkable(end), true, a.areaId); assert.ok(map.route(start, end), `${a.areaId} disconnected`) }
  }
})
test('exit arrival cannot bounce back or trigger twice; walking away rearms it', () => {
  const area = findArea('cross-path-1')!, exit = area.exits[0], calls: string[] = []
  const controller = new AreaExitController(area, id => calls.push(id))
  controller.update(exit); assert.equal(calls.length, 0)
  controller.update({ x: area.width / 2, y: area.height / 2 }); controller.update(exit); controller.update(exit)
  assert.deepEqual(calls, [exit.exitId])
})

test('every playable Level requires proportional runtime dimensions and one deterministic geometry transform', () => {
  const p = source(), normalized = parseWorld(p), nativeSource = source()
  for (const level of nativeSource.levels) {
    if (['Player_Farm','Town_p1'].includes(level.identifier)) continue
    level.fieldInstances.find((f: {__identifier:string}) => f.__identifier === 'runtimeWidth').__value = level.pxWid
    level.fieldInstances.find((f: {__identifier:string}) => f.__identifier === 'runtimeHeight').__value = level.pxHei
  }
  const native = parseWorld(nativeSource)
  assert.deepEqual(parseWorld(p), normalized, 'repeat import is deterministic')
  for (const area of normalized.areas) {
    const level = p.levels.find((l: {identifier:string}) => l.identifier === area.identifier)
    assert.equal(level.fieldInstances.find((f: {__identifier:string}) => f.__identifier === 'runtimeWidth').__value, area.width)
    assert.equal(level.fieldInstances.find((f: {__identifier:string}) => f.__identifier === 'runtimeHeight').__value, area.height)
    const unscaled = native.areas.find(a => a.areaId === area.areaId)!
    if (['farm','town'].includes(area.areaType)) { assert.deepEqual(area, unscaled); assert.deepEqual(area.collision, []); continue }
    assert.equal(area.width * area.topology.height, area.height * area.topology.width)
    assert.ok(area.width >= 1280 && area.height >= 1056)
    assert.deepEqual(topologyToRuntime(area, {x:area.topology.width,y:area.topology.height}), {x:area.width,y:area.height})
    for (const key of ['spawns','exits'] as const) {
      assert.deepEqual(area[key], unscaled[key].map(e => ({...e,...topologyToRuntime(area,e),...('width' in e ? {width:topologyToRuntime(area,{x:e.width,y:e.height}).x,height:topologyToRuntime(area,{x:e.width,y:e.height}).y} : {})})))
    }
    assert.ok(area.collision.length > 0, 'runtime dimensions must not skip rough collision')
    assert.deepEqual(area.collision, unscaled.collision.map(c => {
      const size = topologyToRuntime(area, {x:c.width,y:c.height})
      return {...topologyToRuntime(area,c),width:size.x,height:size.y}
    }))
    assert.equal(area.zoneId, unscaled.zoneId); assert.deepEqual(area.topology, unscaled.topology)
  }
  const cross = p.levels.find((l: {identifier:string}) => l.identifier === 'Cross_Path_1')
  const width = cross.fieldInstances.find((f: {__identifier:string}) => f.__identifier === 'runtimeWidth')
  width.__value = null; assert.throws(() => parseWorld(p), /integer/)
  width.__value = 1300; assert.throws(() => parseWorld(p), /aspect ratio/)
})


test('The Basin display rename preserves saved stable Area and Zone identities', () => {
  const area = findArea('the-first-basin')!
  assert.equal(area.displayName, 'The Basin'); assert.equal(area.zoneId, 'first-basin')
  assert.equal(WORLD.zones.find(z => z.zoneId === area.zoneId)!.displayName, 'The First Basin')
  const spawn = area.spawns.find(s => s.entryId === 'from-path-4')!
  assert.equal(isWorldLocation({...initialLocation(owner), areaId:area.areaId,runtimeAreaId:area.areaId,zoneId:area.zoneId,entryId:spawn.entryId,position:spawn,discoveredAreaIds:[area.areaId]}),true)
})
test('authored trigger regions scale, span openings, reject invalid bounds and keep arrival points separate', () => {
  for (const area of WORLD.areas) for (const exit of area.exits) {
    assert.ok(exit.width > 0 && exit.height > 0)
    for (const spawn of area.spawns) assert.equal(insideExit(spawn,exit,8),false,`${area.areaId}/${spawn.entryId} overlaps ${exit.exitId}`)
    for (const fraction of [-.45,0,.45]) {
      const calls:string[] = [], controller = new AreaExitController(area,id=>calls.push(id))
      const p = exit.width > exit.height ? {x:exit.x+exit.width*fraction,y:exit.y} : {x:exit.x,y:exit.y+exit.height*fraction}
      controller.update({x:exit.x-exit.width-16,y:exit.y-exit.height-16});controller.update(p)
      for(let frame=0;frame<120;frame++)controller.update(p)
      assert.deepEqual(calls,[exit.exitId],'full opening fires once per overlap')
    }
  }
  const p=source(), e=p.levels.find((l:{identifier:string})=>l.identifier==='Cross_Path_1').layerInstances.flatMap((l:{entityInstances:unknown[]})=>l.entityInstances).find((e:{__identifier:string})=>e.__identifier==='AreaExit')
  e.height=128
  assert.equal(parseWorld(p).areas.find(a=>a.areaId==='cross-path-1')!.exits[0].height,640)
  e.width=1000;assert.throws(()=>parseWorld(p),/trigger bounds/)
})
