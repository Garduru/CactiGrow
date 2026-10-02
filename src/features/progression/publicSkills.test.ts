import assert from 'node:assert/strict'
import test from 'node:test'
import { publicSkillsFromXp, getTotalLevel } from './publicSkills.ts'
import { isPublicPlayerProfileV1, isPlayerSearchV1 } from '../../../shared/api/socialV1.ts'

test('Total Level sums all real skills with the existing XP curve', () => {
  const skills = publicSkillsFromXp({ cultivationXp: 388, breedingXp: 174, geneticsXp: 83 })
  assert.deepEqual(skills.map(({ id, level }) => [id, level]), [['cultivation', 5], ['breeding', 3], ['genetics', 2]])
  assert.equal(getTotalLevel(skills), 10)
  assert.equal(getTotalLevel([...skills, { level: 7 }]), 17, 'aggregation accepts additional skills')
  assert.equal(getTotalLevel(publicSkillsFromXp({ cultivationXp: 0, breedingXp: 0, geneticsXp: 0 })), 3)
  assert.equal(getTotalLevel(publicSkillsFromXp({ cultivationXp: 13034431, breedingXp: 13034431, geneticsXp: 13034431 })), 297)
})

test('public skills/search reject forged totals, private fields, duplicate skills and excessive results', () => {
  const skills = publicSkillsFromXp({ cultivationXp: 388, breedingXp: 174, geneticsXp: 83 })
  const result = { projectionVersion: 1, profile: { publicId: '00000000-0000-4000-8000-000000000001', displayName: 'Test Alpha', joinedAt: '2026-01-01', collectionCount: 0, breedingCount: 0, cultivationXp: 388, cultivationLevel: 5, skills, totalLevel: 10 },
    relationship: { isSelf: false, areFriends: false, request: null, blockedByMe: false, blocksMe: false } }
  assert.equal(isPublicPlayerProfileV1(result), true)
  for (const changes of [{ totalLevel: 99 }, { email: 'private' }, { skills: [skills[0], skills[0], skills[0]] }, { skills: skills.map(s => ({ ...s, xp: 100 })) }]) {
    assert.equal(isPublicPlayerProfileV1({ ...result, profile: { ...result.profile, ...changes } }), false)
  }
  assert.equal(isPlayerSearchV1({ projectionVersion: 1, results: [result] }), true)
  assert.equal(isPlayerSearchV1({ projectionVersion: 1, results: Array(13).fill(result) }), false)
})
