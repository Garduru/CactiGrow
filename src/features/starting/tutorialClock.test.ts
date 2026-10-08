import assert from 'node:assert/strict'
import test from 'node:test'
import { TutorialClock } from './tutorialClock.ts'
test('15-second tutorial remains 15 seconds with a device clock 16 seconds behind or ahead', () => {
  for (const skew of [-16000, 16000]) {
    let elapsed = 100
    const server = Date.parse('2026-10-07T12:00:00Z'), clock = new TutorialClock(() => elapsed, () => server+skew)
    clock.sync(new Date(server).toISOString())
    elapsed += 14999; assert.equal(server+15000-clock.now(), 1)
    elapsed += 1; assert.equal(server+15000-clock.now(), 0)
  }
})
