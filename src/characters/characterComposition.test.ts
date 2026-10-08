import assert from 'node:assert/strict'
import test from 'node:test'
import { CHARACTER_DIRECTIONS, CHARACTER_LAYER_ORDER, CHARACTER_MODULES, resolveCharacterComposition } from './characterArt.ts'
import { CHARACTER_FIT } from './characterFit.generated.ts'

test('satchel strap attaches exactly to the posed shoulder and pouch hook in both bodies and all twenty poses', () => {
  for (const body of [0, 1]) for (const facing of CHARACTER_DIRECTIONS) for (let frame = 0; frame < 5; frame++) {
    const plan = resolveCharacterComposition({ skin: 0, shirt: 0, body, accessory: 1 }, { facing, frame })
    const source = CHARACTER_FIT.satchel.frames[plan.row]
    const [a, b, c, d, tx, ty] = plan.strapMatrix
    for (const [point, target] of [[source.root, plan.shoulder], [source.hook, plan.hook]]) {
      assert.ok(Math.abs(a * point[0] + c * point[1] + tx - target[0]) < 1e-9)
      assert.ok(Math.abs(b * point[0] + d * point[1] + ty - target[1]) < 1e-9)
    }
    assert.ok(plan.pouch[1] > plan.shoulder[1] + 35)
    assert.ok(Math.abs(plan.pouch[0] - plan.hip[0]) <= 4)
    assert.equal(plan.farPouch, facing === 'east')
    assert.ok(plan.pouchScale >= .6 && plan.pouchScale <= .7)
  }
})

test('hat fitting leaves the confirmed source pupil patches clear while retaining crown margins', () => {
  for (const body of [0, 1]) for (let frame = 0; frame < 5; frame++) for (const hat of [1, 2]) {
    const plan = resolveCharacterComposition({ skin: 0, shirt: 0, body, hat }, { facing: 'south', frame })
    const lowestSourcePixel = hat === 1 ? 45 : 51
    const top = plan.hatAnchor[1] + (8 - 24) * plan.hatVerticalScale
    const bottom = plan.hatAnchor[1] + (lowestSourcePixel - 24) * plan.hatVerticalScale
    assert.ok(top >= 4, 'headwear must preserve transparent canvas margin')
    assert.equal(plan.protectedEyes.length, 2)
    assert.ok(plan.protectedEyes.every(eye => bottom < eye[1] - 2), 'brim must sit above both 3x3 pupil patches')
    assert.ok(plan.hairCrownClip! < plan.faceOpening[1] - 6, 'hat keeps the lower fringe/nape')
  }
})

test('body-specific fitting follows the authored walk attachments and keeps palette geometry identical', () => {
  for (const body of [0, 1]) for (const facing of CHARACTER_DIRECTIONS) {
    const plans = Array.from({ length: 5 }, (_, frame) => resolveCharacterComposition({ skin: 0, shirt: 0, body, hair: 3, hat: 2, accessory: 1 }, { facing, frame }))
    assert.ok(new Set(plans.map(plan => JSON.stringify([plan.crown, plan.shoulder, plan.hip]))).size >= 3)
    assert.ok(plans.every(plan => plan.hairScale >= .86 && plan.hairScale <= 1.04))
    for (let frame = 0; frame < 5; frame++) {
      assert.deepEqual(plans[frame], resolveCharacterComposition({ skin: 2, shirt: 3, pants: 2, hairColor: 3, body, hair: 3, hat: 2, accessory: 1 }, { facing, frame }))
    }
  }
  assert.notDeepEqual(resolveCharacterComposition({ skin: 0, shirt: 0, body: 0 }), resolveCharacterComposition({ skin: 0, shirt: 0, body: 1 }))
})

test('registered layer order provides rear hair/accessory and source-arm occlusion before front hair/headwear', () => {
  assert.deepEqual(CHARACTER_LAYER_ORDER, ['rearHair', 'rearAccessory', 'body', 'frontAccessory', 'foregroundArms', 'frontHair', 'headwear'])
  assert.equal(CHARACTER_MODULES.masculine, '/assets/characters/player/masculine/desert-grower-masculine-poses-v02.webp')
  assert.equal(CHARACTER_MODULES.feminine, '/assets/characters/player/feminine/desert-grower-feminine-poses-v02.webp')
  assert.equal(CHARACTER_MODULES.mara, '/assets/characters/npc/mara/desert-mara-poses-v03.webp')
  assert.equal(CHARACTER_FIT.mara.uniquePoses, 20)
  for (const body of ['masculine', 'feminine'] as const) {
    assert.ok(CHARACTER_FIT.bodies[body].frames.every(frame => frame.armAlphaPixels > 300))
  }
})
