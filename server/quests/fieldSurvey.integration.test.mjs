import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { WORLD, findArea } from '../../shared/world/world.ts'
import { FIELD_SURVEY, isFieldSurveyResultV1 } from '../../shared/api/fieldSurveyV1.ts'

test('Field Survey uses restricted real PostgreSQL and existing world/harvest authority', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.' }, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const password = crypto.randomUUID(), cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-field-survey-${crypto.randomUUID()}`), user: 'postgres', password, port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('field_survey_test')
  const connection = cluster.getPgClient('field_survey_test', '127.0.0.1'); await connection.connect()
  const { Pool } = await import('pg'), pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'field_survey_test', max: 6 })
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
    await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve('node_modules/.tmp/field-survey-db.mjs')
    await build({ stdin: { contents: `export { FieldSurveyService } from './server/quests/FieldSurveyService.ts'; export { ExplorationService } from './server/exploration/ExplorationService.ts'; export { StartingExperienceService } from './server/starting/StartingExperienceService.ts'; export { StartingResetService } from './server/starting/StartingResetService.ts'; export { WorldService } from './server/world/WorldService.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts'; export { createApiRouter } from './server/api/router.ts'; export { handleApiRequest } from './server/api/handler.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
    const { FieldSurveyService, ExplorationService, StartingExperienceService, StartingResetService, WorldService, initializeStagingGrower, createApiRouter, handleApiRequest } = await import(pathToFileURL(out).href)
    const { drizzle } = await import('drizzle-orm/node-postgres'), db = drizzle(pool), [a, b, fresh] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    for (const [index, id] of [a, b, fresh].entries()) {
      await connection.query('insert into players(id)values($1)', [id]); await initializeStagingGrower(db, id, index === 2)
      await connection.query('insert into player_profiles(player_id,public_id,display_name)values($1,$2,$3)', [id, crypto.randomUUID(), 'Survey Tester ' + index])
    }
    await connection.query(`create role survey_runtime; grant usage on schema public to survey_runtime; grant select on all tables in schema public to survey_runtime;
      grant insert,update on player_onboarding,player_seed_stacks,player_plant_lifecycle_versions to survey_runtime;
      grant update on nursery_occupancies to survey_runtime;
      grant insert on player_grower_events,player_grower_state to survey_runtime;`)
    pool.on('connect', client => { void client.query('set role survey_runtime') }); await pool.query('set role survey_runtime')
    let clock = new Date(Date.now() + 60_000)
    const survey = () => new FieldSurveyService(db, { environment: 'staging', now: () => clock }), exploration = () => new ExplorationService(db, { environment: 'staging', now: () => clock, rollYield: () => 6 })
    const world = new WorldService(db), starting = new StartingExperienceService(db, () => clock)
    const advance = (ms = 60_000) => { clock = new Date(clock.getTime() + ms) }
    const routeTo = (from, to) => {
      const queue = [[from, []]], seen = new Set([from])
      while (queue.length) { const [current, route] = queue.shift(); if (current === to) return route
        for (const exit of findArea(current).exits) if (!exit.blocked && exit.targetAreaId && !seen.has(exit.targetAreaId)) { seen.add(exit.targetAreaId); queue.push([exit.targetAreaId, [...route, exit.exitId]]) } }
      throw new Error('No authored route')
    }
    const enter = async (id, areaId) => {
      let location = await world.read(id)
      for (const exitId of routeTo(location.areaId, areaId)) location = await world.transition(id, { v: 1, commandId: crypto.randomUUID(), exitId, expectedRevision: location.revision })
      await connection.query("update player_grower_events set occurred_at=$3 where player_id=$1 and event_type='world-foundation-location-v1' and (payload->>'revision')::integer=$2", [id, location.revision, clock])
      return location
    }
    const npc = findArea(FIELD_SURVEY.npcAreaId).interactables.find(n => n.entityId === FIELD_SURVEY.npcEntityId)
    assert.ok(npc, 'Survey station must be authored')
    const questCommand = (location, type, position = npc) => ({ v: 1, commandId: crypto.randomUUID(), type, entityId: npc.entityId, expectedWorldRevision: location.revision, position: { x: position.x, y: position.y } })
    const exploreCommand = (location, type, target, position = target) => ({ v: 1, commandId: crypto.randomUUID(), type, expectedWorldRevision: location.revision, position: { x: position.x, y: position.y }, ...(type === 'discover-landmark' ? { landmarkId: target.landmarkId } : { entityId: target.entityId }) })
    const ledger = async id => {
      const owner = (await connection.query('select token_balance from player_onboarding where player_id=$1', [id])).rows[0]
      const stacks = (await connection.query('select species_id,quantity from player_seed_stacks where player_id=$1 order by species_id', [id])).rows
      return { currency: owner.token_balance, xp: (await starting.read(id)).harvestingXp, stacks }
    }
    const prepareGear = async id => { await exploration().read(id); await starting.execute(id, { type: 'equip-tool', itemId: 'field-knife', commandId: crypto.randomUUID() }) }
    const gather = async (id, areaId, speciesId) => { const location = await enter(id, areaId); advance(); const node = findArea(areaId).interactables.find(n => n.kind === 'harvestable' && !n.tutorial && n.speciesId === speciesId); return exploration().execute(id, exploreCommand(location, 'harvest', node)) }
    const discover = async (id, landmarkId) => { const area = WORLD.areas.find(a => a.landmarks?.some(l => l.landmarkId === landmarkId)), location = await enter(id, area.areaId); advance(); return exploration().execute(id, exploreCommand(location, 'discover-landmark', area.landmarks.find(l => l.landmarkId === landmarkId))) }
    let reportCommand, bLocation

    await t.test('Farm prerequisite hides survey during onboarding, while established compatible players are eligible', async () => {
      assert.equal((await survey().read(fresh)).projection.status, 'locked')
      await assert.rejects(survey().execute(fresh, questCommand({ revision: 0 }, 'accept')), /Farm introduction/)
      const established = await survey().read(a); assert.equal(established.starting.compatibilityComplete, true); assert.equal(established.projection.status, 'available'); assert.ok(isFieldSurveyResultV1(established))
      assert.equal((await exploration().read(fresh)).fieldSurvey.status, 'locked')
    })
    await t.test('quest remains optional: normal exploration and authored travel work without acceptance', async () => {
      await prepareGear(a); await gather(a, 'cross-path-1', 'echinopsis-pachanoi')
      const state = (await survey().read(a)).projection
      assert.equal(state.status, 'available'); assert.equal(state.acceptedAt, null); assert.equal(state.objectives.sanPedroHarvested, true)
      assert.equal((await enter(a, 'town-p1')).areaId, 'town-p1')
    })
    await t.test('prior legitimate wild harvests and discoveries reconcile without another respawn or duplicate reward', async () => {
      await gather(a, 'the-first-basin', 'lophophora-williamsii')
      for (const id of FIELD_SURVEY.landmarkIds) await discover(a, id)
      await discover(a, FIELD_SURVEY.caveLandmarkId)
      const location = await enter(a, FIELD_SURVEY.caveAreaId); advance()
      const note = findArea(FIELD_SURVEY.caveAreaId).interactables.find(n => n.noteId === FIELD_SURVEY.caveNoteId)
      await exploration().execute(a, exploreCommand(location, 'inspect', note))
      const before = await ledger(a), station = await enter(a, FIELD_SURVEY.npcAreaId); advance()
      const result = await survey().execute(a, questCommand(station, 'accept'))
      assert.equal(result.projection.status, 'ready-to-report'); assert.ok(result.projection.objectives.landmarks.every(l => l.discoveredAt)); assert.equal(result.reward, undefined)
      assert.deepEqual(await ledger(a), before); assert.equal(result.projection.objectives.peyoteHarvested, true)
    })
    await t.test('acceptance persists, rejects duplicate acceptance, and needs real clear NPC proximity/revision', async () => {
      bLocation = await enter(b, FIELD_SURVEY.npcAreaId)
      await assert.rejects(survey().execute(b, questCommand(bLocation, 'accept')), /too fast/)
      advance()
      await assert.rejects(survey().execute(b, questCommand(bLocation, 'accept', { x: 250, y: 940 })), /Return to Mara/)
      await assert.rejects(survey().execute(b, { ...questCommand(bLocation, 'accept'), expectedWorldRevision: bLocation.revision - 1 }), /location changed/)
      const accept = questCommand(bLocation, 'accept'), result = await survey().execute(b, accept)
      assert.equal(result.projection.status, 'active'); assert.equal(result.projection.revision, 1)
      assert.equal((await survey().execute(b, accept)).projection.revision, 1)
      await assert.rejects(survey().execute(b, questCommand(bLocation, 'accept')), /already accepted/)
      assert.deepEqual((await survey().read(b)).projection, result.projection)
      await assert.rejects(survey().execute(b, { ...accept, type: 'report' }), /command ID/)
    })
    await t.test('return report cannot complete early and has no manual objective spoofing path', async () => {
      await assert.rejects(survey().execute(b, questCommand(bLocation, 'report')), /Finish the field observations/)
      for (const mutation of [{ type: 'mark-complete' }, { completed: true }, { objectives: { sanPedroHarvested: true } }, { reward: { currency: 1000 } }, { entityId: 'mara-guide' }]) await assert.rejects(survey().execute(b, { ...questCommand(bLocation, 'report'), ...mutation }), /Invalid Field Survey command/)
      assert.equal((await survey().read(b)).projection.status, 'active')
    })
    await t.test('selected west-middle-east landmarks advance live; other Basin landmarks do not substitute', async () => {
      const extra = await discover(b, 'cairn'); assert.equal(extra.fieldSurvey.objectives.landmarks.filter(l => l.discoveredAt).length, 0)
      let count = 0, progressRevision = extra.fieldSurvey.progressRevision
      for (const id of FIELD_SURVEY.landmarkIds) { const result = await discover(b, id); assert.equal(result.fieldSurvey.objectives.landmarks.filter(l => l.discoveredAt).length, ++count)
        assert.ok(result.fieldSurvey.progressRevision > progressRevision); progressRevision = result.fieldSurvey.progressRevision }
      assert.equal((await survey().read(b)).projection.status, 'active')
    })
    await t.test('San Pedro progress requires legitimate receipt and does not use existing seed ownership', async () => {
      assert.equal((await survey().read(b)).projection.objectives.sanPedroHarvested, false)
      await prepareGear(b)
      const result = await gather(b, 'path-4', 'echinopsis-pachanoi'); assert.equal(result.fieldSurvey.objectives.sanPedroHarvested, true); assert.equal(result.fieldSurvey.objectives.peyoteHarvested, false)
    })
    await t.test('Peyote progress advances from ordinary wild harvest without changing its normal reward', async () => {
      const before = await ledger(b), result = await gather(b, 'the-first-basin', 'lophophora-williamsii')
      assert.equal(result.fieldSurvey.objectives.peyoteHarvested, true); assert.equal(result.reward.quantity, 6); assert.equal(result.reward.harvestingXp, 10)
      assert.equal((await ledger(b)).xp, before.xp + 10); assert.equal(result.fieldSurvey.status, 'active')
    })
    await t.test('Basin Cave requires actual authored Area entry, then persisted landmark and mineral inspection separately', async () => {
      const before = (await survey().read(b)).projection; assert.equal(before.objectives.caveEntered, false)
      const location = await enter(b, FIELD_SURVEY.caveAreaId)
      const entered = (await survey().read(b)).projection; assert.equal(entered.objectives.caveEntered, true); assert.equal(entered.objectives.caveLandmarkDiscovered, false); assert.equal(entered.objectives.caveNoteInspected, false)
      assert.ok(entered.progressRevision > before.progressRevision, 'Area entry orders responses even without a quest revision change')
      const discovered = await discover(b, FIELD_SURVEY.caveLandmarkId); assert.equal(discovered.fieldSurvey.objectives.caveLandmarkDiscovered, true); assert.equal(discovered.fieldSurvey.status, 'active')
      advance(); const note = findArea(FIELD_SURVEY.caveAreaId).interactables.find(n => n.noteId === FIELD_SURVEY.caveNoteId)
      const inspected = await exploration().execute(b, exploreCommand(location, 'inspect', note)); assert.equal(inspected.fieldSurvey.objectives.caveNoteInspected, true); assert.equal(inspected.fieldSurvey.status, 'ready-to-report'); assert.equal(inspected.fieldSurvey.completedAt, null)
    })
    await t.test('final conversation must occur at Mara and exactly-once reward commits with report receipt', async () => {
      const wilderness = await world.read(b)
      await assert.rejects(survey().execute(b, questCommand(wilderness, 'report')), /Return to Mara/)
      const station = await enter(b, FIELD_SURVEY.npcAreaId); advance(); reportCommand = questCommand(station, 'report')
      const concurrentReport = questCommand(station, 'report'), before = await ledger(b), outcomes = await Promise.allSettled([survey().execute(b, reportCommand), survey().execute(b, concurrentReport)])
      assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1)
      const result = outcomes.find(o => o.status === 'fulfilled').value
      assert.equal(result.projection.status, 'complete'); assert.equal(result.projection.rewardClaimed, true); assert.deepEqual(result.reward, FIELD_SURVEY.reward)
      const after = await ledger(b); assert.equal(after.xp, before.xp + 30); assert.equal(after.currency, before.currency + 25); assert.deepEqual(after.stacks, before.stacks)
      const rewards = await connection.query("select count(*)::integer as count from player_grower_events where player_id=$1 and event_type='first-basin-field-survey-reward-v1'", [b]); assert.equal(rewards.rows[0].count, 1)
      if (outcomes[1].status === 'fulfilled') reportCommand = concurrentReport
      const replay = await survey().execute(b, reportCommand); assert.equal(replay.projection.status, 'complete'); assert.deepEqual(await ledger(b), after)
      await assert.rejects(survey().execute(b, questCommand(station, 'report')), /already reported/)
    })
    await t.test('new service/authenticated reads preserve completion and isolate another established account', async () => {
      assert.equal((await survey().read(b)).projection.status, 'complete'); assert.equal((await exploration().read(b)).fieldSurvey.status, 'complete')
      assert.equal((await survey().read(a)).projection.status, 'ready-to-report'); assert.equal((await survey().read(a)).projection.rewardClaimed, false)
    })
    await t.test('quest-only reset preserves field records, history, earned rewards and another account; reaccept gives no second reward', async () => {
      const before = await exploration().read(b), money = await ledger(b), other = await survey().read(a), location = await world.read(b)
      const reset = { v: 1, commandId: crypto.randomUUID(), type: 'reset-field-survey', expectedRevision: before.fieldSurvey.revision }
      const cleared = await survey().reset(b, reset); assert.equal(cleared.projection.status, 'available'); assert.equal(cleared.projection.rewardClaimed, true)
      assert.deepEqual((await exploration().read(b)).projection, before.projection); assert.deepEqual(await ledger(b), money); assert.deepEqual(await world.read(b), location); assert.deepEqual(await survey().read(a), other)
      assert.equal((await survey().reset(b, reset)).projection.revision, cleared.projection.revision)
      await assert.rejects(survey().reset(b, { ...reset, commandId: crypto.randomUUID() }), /state changed/)
      const oldReport = await survey().execute(b, reportCommand); assert.equal(oldReport.projection.status, 'available'); assert.deepEqual(await ledger(b), money)
      await survey().execute(b, questCommand(location, 'accept')); const completed = await survey().execute(b, questCommand(location, 'report'))
      assert.equal(completed.projection.status, 'complete'); assert.equal(completed.reward, undefined); assert.deepEqual(await ledger(b), money)
    })
    await t.test('reward capacity failure rolls back completion, XP, currency and lifetime claim before safe retry', async () => {
      const location = await world.read(a), report = questCommand(location, 'report'), before = await ledger(a), state = (await survey().read(a)).projection
      await connection.query('update player_onboarding set token_balance=2147483647 where player_id=$1', [a])
      await assert.rejects(survey().execute(a, report), /storage capacity/)
      const after = await survey().read(a)
      assert.equal(after.projection.completedAt, null); assert.equal(after.projection.rewardClaimed, false); assert.equal(after.projection.revision, state.revision)
      assert.equal(after.starting.harvestingXp, before.xp); assert.equal((await ledger(a)).currency, 2147483647)
      const receipts = await connection.query("select count(*)::integer as count from player_grower_events where player_id=$1 and source_command_id=$2", [a, report.commandId]); assert.equal(receipts.rows[0].count, 0)
      await connection.query('update player_onboarding set token_balance=$2 where player_id=$1', [a, before.currency])
      const retried = await survey().execute(a, report); assert.equal(retried.projection.status, 'complete'); assert.deepEqual(retried.reward, FIELD_SURVEY.reward)
      const paid = await ledger(a); assert.equal(paid.currency, before.currency + 25); assert.equal(paid.xp, before.xp + 30); assert.deepEqual(paid.stacks, before.stacks)
    })
    await t.test('normal tutorial reset preserves quest reward Harvesting XP and permanent claim', async () => {
      const before = await ledger(b), state = await survey().read(b)
      await new StartingResetService(db, 'staging').execute(b, { commandId: crypto.randomUUID(), mode: 'tutorial', targetPlayerId: b, confirmPlayerId: b })
      const after = await ledger(b); assert.equal(after.xp, before.xp); assert.equal(after.currency, before.currency); assert.deepEqual(after.stacks, before.stacks)
      const result = await survey().read(b); assert.equal(result.projection.rewardClaimed, true); assert.equal(result.projection.completedAt, state.projection.completedAt); assert.equal(result.projection.status, 'locked')
    })
    await t.test('API validates authenticated ownership and keeps production Dev Tools unavailable', async () => {
      const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => request.getHeader('x-test-player') === a ? { provider: 'test', subject: a } : null }, createPlayerIdentityResolver: async () => ({ resolve: async () => ({ playerId: a }) }) }) })
      let opens = 0
      const request = (path, environment, body, authenticated = true) => handleApiRequest(new Request('https://survey.test' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(authenticated ? { 'x-test-player': a } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'test', ...(environment === 'staging' ? { CACTIGROW_ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com', CACTIGROW_ACCESS_AUDIENCE: 'test' } : {}) }, undefined, { router, createRequestDatabaseContext: () => ({ getDatabase: async () => { opens++; return db }, dispose: async () => {} }) })
      for (const path of ['/api/v1/dev/field-survey']) for (const body of [null, { v: 1, type: 'reset-field-survey', commandId: crypto.randomUUID(), expectedRevision: 0 }]) assert.equal((await request(path, 'production', body)).status, 404)
      assert.equal(opens, 0); assert.equal((await request('/api/v1/me/field-survey', 'test', null, false)).status, 401)
      const read = await request('/api/v1/me/field-survey', 'test', null); assert.equal(read.status, 200); assert.ok(isFieldSurveyResultV1((await read.json()).data))
      assert.equal((await request('/api/v1/me/field-survey', 'test', { ...questCommand(await world.read(a), 'report'), objectives: { completed: true } })).status, 400)
      assert.equal((await request('/api/v1/dev/field-survey', 'staging', { v: 1, commandId: crypto.randomUUID(), type: 'reset-field-survey', expectedRevision: 0, targetPlayerId: b })).status, 400)
      assert.ok((await new FieldSurveyService(db, { environment: 'production' }).read(a)).projection)
    })
  } finally { await pool.end(); await connection.end(); await cluster.stop() }
})
