import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

test('production remount restores durable projections, gates missing data, and never falls back to demo progress', async t => {
  const directory = resolve('node_modules/.tmp')
  await mkdir(directory, { recursive: true })
  const file = resolve(directory, `persistence-${crypto.randomUUID()}.mjs`)
  t.after(() => unlink(file))
  const bundled = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { GameStateProvider } from './src/game/GameStateProvider';
    import { GameStateContext } from './src/game/GameStateContext';
    import { GrowerAuthorityContext } from './src/app/GrowerAuthorityContext';
    import { PlantLifecycleContext } from './src/app/PlantLifecycleContext';
    import { GardenAuthorityContext } from './src/app/GardenAuthorityContext';
    export { createInitialGameState } from './src/game/gameState';
    export { restoreServerGameState } from './src/game/restoreServerGameState';
    export function render(grower, plants, garden) {
      return renderToStaticMarkup(<GrowerAuthorityContext.Provider value={{state:grower}}>
        <PlantLifecycleContext.Provider value={{state:plants}}><GardenAuthorityContext.Provider value={garden}>
          <GameStateProvider><GameStateContext.Consumer>{value => <div>READY:{value.state.player.id}:{value.state.inventory[0]?.quantity}</div>}</GameStateContext.Consumer></GameStateProvider>
        </GardenAuthorityContext.Provider></PlantLifecycleContext.Provider></GrowerAuthorityContext.Provider>);
    }
  ` }, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false }) } })
  await writeFile(file, bundled.outputFiles[0].contents)
  const { createInitialGameState, restoreServerGameState, render } = await import(pathToFileURL(file).href)
  const blank = createInitialGameState(0, true)
  assert.equal(blank.inventory.length, 0)
  assert.equal(blank.nurserySlots.some((slot: { plant: unknown }) => slot.plant), false)
  assert.deepEqual(blank.cloneLines, {})
  const plant = { specimenId: 'persisted-plant', cloneLineId: 'persisted-line', speciesId: 'echinopsis-pachanoi',
    plantedAt: '2026-01-01T00:00:00Z', collectedAt: null, genetics: { vigor: 50 }, geneticFeatures: [], specialVariants: [], isHybrid: false }
  const plants = { seedStacks: [{ speciesId: plant.speciesId, quantity: 2 }], nursery: { capacity: 6, slots: [{ slotId: 'slot-1',
    occupancy: { plantedAt: plant.plantedAt, readyAt: '2026-01-01T00:05:00Z', specimen: plant } }] },
    ownedSpecimens: [{ ...plant, specimenId: 'collected', collectedAt: '2025-12-31T23:00:00Z' }],
    bredSeeds: [{ seedId: 'bred-seed', cloneLineId: 'bred-line', speciesId: plant.speciesId, createdAt: plant.plantedAt,
      genetics: plant.genetics, geneticFeatures: [], specialVariants: [], parentPlantIds: ['parent-a', 'parent-b'] }] }
  const grower = { player: { playerId: 'account-a', tokenBalance: 200, skills: { cultivationXp: 90, breedingXp: 10, geneticsXp: 20 } },
    seedTreatments: {}, marketplaceListings: [], achievements: [], discoveries: {}, journalStats: {}, research: {}, lab: blank.geneticsLab,
    property: { ...blank.property, testSavedUpgrade: 'retained' } }
  const garden = { organization: { collected: { favorite: true } }, displayAssignments: { 'garden-display-back-left': 'collected' } }
  // A fresh reducer at a much later browser launch must not replace server data.
  const first = restoreServerGameState(createInitialGameState(0, false), grower, plants, garden)
  const reopened = restoreServerGameState(createInitialGameState(600_000, true),
    structuredClone(grower), structuredClone(plants), structuredClone(garden))
  for (const key of ['player', 'inventory', 'nurserySlots', 'ownedPlants', 'bredSeeds', 'property', 'gardenOrganization', 'gardenDisplayAssignments', 'geneticsLab']) {
    assert.deepEqual(first[key], reopened[key], key)
  }
  assert.equal(reopened.nurserySlots[0].plant.id, 'persisted-plant')
  assert.equal(reopened.nurserySlots[0].plant.plantedAt, plant.plantedAt)
  assert.equal(reopened.inventory[0].quantity, 2)
  assert.equal(reopened.ownedPlants[0].id, 'collected')
  assert.equal(reopened.bredSeeds[0].id, 'bred-seed')
  const other = restoreServerGameState(reopened, { ...grower, player: { ...grower.player, playerId: 'account-b', tokenBalance: 0 } },
    { seedStacks: [], nursery: { capacity: 6, slots: [] }, ownedSpecimens: [], bredSeeds: [] }, { organization: {}, displayAssignments: {} })
  assert.equal(other.player.id, 'account-b')
  assert.equal(other.inventory.length + other.ownedPlants.length + other.nurserySlots.length + other.bredSeeds.length, 0)
  const ready = { authority: 'server', status: 'ready', projection: grower }
  const readyPlants = { authority: 'server', status: 'ready', projection: plants }
  assert.match(render(ready, readyPlants, { projection: garden }), /READY:account-a:2/)
  for (const status of ['loading', 'error']) {
    const html = render({ authority: 'server', status, projection: null }, readyPlants, { projection: garden })
    assert.ok(!html.includes('READY:'))
    assert.ok(!html.includes('1216'))
  }
  assert.ok(!render(ready, { authority: 'server', status: 'loading', projection: null }, { projection: garden }).includes('READY:'))
  assert.match(render(ready, readyPlants, { projection: null, error: true }), /Unable to load your saved game/)
})
