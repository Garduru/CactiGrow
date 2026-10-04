import assert from 'node:assert/strict'
import test from 'node:test'
import { startPlayerAuthorityReconciliation } from './playerAuthorityReconciliation.ts'
import { isPlayerAuthorityRevisionV1 } from '../../shared/api/playerAuthorityRevisionV1.ts'

function fixture() {
  let time = 0, id = 0, reads = 0, grower = 0, lifecycle = 0, succeed = true
  let revision = { projectionVersion: 1 as const, profileVersion: 2, growerVersion: 100, lifecycleVersion: 3 }
  let fail: unknown
  let wait: Promise<void> | undefined
  const timers = new Map<number, { at: number; callback: () => void }>()
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const window = new EventTarget()
  const stop = startPlayerAuthorityReconciliation({
    document, window, now: () => time,
    schedule(callback, delay) { const key = ++id; timers.set(key, { at: time + delay, callback }); return () => { timers.delete(key) } },
    async read(signal) { reads++; await wait; if (signal.aborted) throw new Error('aborted'); if (fail) throw fail; return { ...revision } },
    async refreshGrower() { grower++; return succeed }, async refreshLifecycle() { lifecycle++; return succeed },
  })
  const tick = async (ms: number) => {
    time += ms
    for (const [key, timer] of [...timers]) if (timer.at <= time) { timers.delete(key); timer.callback() }
    for (let i = 0; i < 12; i++) await Promise.resolve()
  }
  return { stop, tick, timers, document, window, counts: () => [reads, grower, lifecycle], setRevision: (value: Partial<typeof revision>) => { revision = { ...revision, ...value } }, setSuccess: (value: boolean) => { succeed = value }, setFailure: (value: unknown) => { fail = value }, setWait: (value?: Promise<void>) => { wait = value } }
}

test('unchanged revisions do not refetch full projections; currency/XP counter changes are not hidden by higher Grower counter', async () => {
  const f = fixture()
  try {
    assert.deepEqual(f.counts(), [0, 0, 0])
    await f.tick(30_000); assert.deepEqual(f.counts(), [1, 1, 1])
    await f.tick(30_000); assert.deepEqual(f.counts(), [2, 1, 1])
    f.setRevision({ profileVersion: 3 }); await f.tick(30_000); assert.deepEqual(f.counts(), [3, 2, 1])
    f.setRevision({ lifecycleVersion: 4 }); await f.tick(30_000); assert.deepEqual(f.counts(), [4, 2, 2])
    f.setRevision({ growerVersion: 101 }); await f.tick(30_000); assert.deepEqual(f.counts(), [5, 3, 2])
  } finally { f.stop() }
})

test('hidden tabs pause; focus/visibility events coalesce, retain cooldown and teardown cancels work', async () => {
  const f = fixture()
  f.document.visibilityState = 'hidden'; f.document.dispatchEvent(new Event('visibilitychange'))
  await f.tick(90_000); assert.deepEqual(f.counts(), [0, 0, 0])
  f.document.visibilityState = 'visible'; f.document.dispatchEvent(new Event('visibilitychange')); f.window.dispatchEvent(new Event('focus'))
  await f.tick(0); assert.deepEqual(f.counts(), [1, 1, 1])
  for (let i = 0; i < 5; i++) f.window.dispatchEvent(new Event('focus'))
  await f.tick(4_999); assert.deepEqual(f.counts(), [1, 1, 1])
  await f.tick(1); assert.deepEqual(f.counts(), [2, 1, 1])
  f.stop(); assert.equal(f.timers.size, 0)
  f.window.dispatchEvent(new Event('focus')); await f.tick(60_000); assert.deepEqual(f.counts(), [2, 1, 1])
})

test('failed/superseded authoritative refresh retries same revision; transient errors retain cadence', async () => {
  const f = fixture()
  try {
    f.setSuccess(false); await f.tick(30_000); assert.deepEqual(f.counts(), [1, 1, 1])
    f.setSuccess(true); await f.tick(30_000); assert.deepEqual(f.counts(), [2, 2, 2])
    f.setFailure(new Error('offline')); await f.tick(30_000); assert.deepEqual(f.counts(), [3, 2, 2])
    f.setFailure(undefined); f.setRevision({ profileVersion: 4 }); await f.tick(30_000); assert.deepEqual(f.counts(), [4, 3, 2])
  } finally { f.stop() }
})

test('slow checks never overlap and expired authentication stops background requests', async () => {
  const f = fixture()
  let resolve!: () => void
  f.setWait(new Promise<void>(done => { resolve = done }))
  await f.tick(30_000)
  f.window.dispatchEvent(new Event('focus')); await f.tick(5_000); assert.deepEqual(f.counts(), [1, 0, 0])
  resolve(); f.setWait(); await f.tick(0); assert.deepEqual(f.counts(), [1, 1, 1])
  f.setFailure({ status: 401 }); await f.tick(30_000)
  f.window.dispatchEvent(new Event('focus')); await f.tick(90_000); assert.deepEqual(f.counts(), [2, 1, 1])
  f.stop()
})

test('revision contract rejects malformed, negative, fractional and unsafe versions', () => {
  const valid = { projectionVersion: 1, profileVersion: 1, growerVersion: 1, lifecycleVersion: 0 }
  assert.ok(isPlayerAuthorityRevisionV1(valid))
  for (const value of [null, {}, { ...valid, profileVersion: -1 }, { ...valid, lifecycleVersion: 0.5 }, { ...valid, growerVersion: Number.MAX_SAFE_INTEGER + 1 }, { ...valid, projectionVersion: 2 }]) assert.equal(isPlayerAuthorityRevisionV1(value), false)
})

test('timed-out or hidden in-flight checks never commit an observed revision and retry on return', async () => {
  const f = fixture()
  let resolve!: () => void
  f.setWait(new Promise<void>(done => { resolve = done }))
  await f.tick(30_000); await f.tick(15_000)
  resolve(); f.setWait(); await f.tick(0)
  assert.deepEqual(f.counts(), [1, 0, 0])
  await f.tick(30_000); assert.deepEqual(f.counts(), [2, 1, 1])
  f.document.visibilityState = 'hidden'; f.document.dispatchEvent(new Event('visibilitychange'))
  await f.tick(60_000); assert.deepEqual(f.counts(), [2, 1, 1])
  f.stop()
})
