import { createInitialGameState, gameStateReducer } from '../src/game/gameState'
import { farmLocations, resolveWorldBuilding } from '../src/features/farm/locations'
import { NURSERY_EXPANDED_BENCHES_UPGRADE_ID, nurseryLevels } from '../src/features/property/propertyConfig'
import { MAX_DEVELOPED_BUILDING_LEVEL, getNurseryCapacity, getPropertyUpgradeStatus, getWorldBuildingLevel } from '../src/features/property/propertyModel'
import { XP_THRESHOLDS } from '../src/features/progression/progressionModel'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }

const now = Date.UTC(2026, 0, 1)
const initial = createInitialGameState(now)
assert(MAX_DEVELOPED_BUILDING_LEVEL === 5, 'Developed building level cap must be 5')
assert(nurseryLevels.map((level) => level.growSlotCapacity).join(',') === '6,8,12,16,20', 'Nursery capacity path must be centralized')
assert(getNurseryCapacity(initial.property) === 6 && initial.nurserySlots.length === 6, 'Level 1 Nursery must have six slots')
assert(farmLocations.length === 6 && farmLocations.some((building) => building.id === 'home' && building.route === '/home'), 'Farm must contain routed Home')
for (const buildingId of ['home', 'nursery', 'garden', 'shop', 'market'] as const) assert(initial.property.buildings[buildingId].level === 1, `${buildingId} must start at Level 1`)
const lab = farmLocations.find((building) => building.id === 'lab')!
assert(getWorldBuildingLevel('lab', initial.property, initial.geneticsLab) === 0, 'Tier 0 Lab must display Level 0')
assert(resolveWorldBuilding(lab, initial.property, { ...initial.geneticsLab, tier: 3 }).label.includes('Lv. 3'), 'Lab label must derive from tier')

const underLevel = getPropertyUpgradeStatus(initial.property, initial.player, NURSERY_EXPANDED_BENCHES_UPGRADE_ID)
assert(!underLevel.eligible && underLevel.reasons.some((reason) => reason.includes('Cultivation Level 10')), 'Cultivation 10 must be required')
const eligible = {
  ...initial,
  player: { ...initial.player, skills: { ...initial.player.skills, cultivation: { xp: XP_THRESHOLDS[9] } } },
}
assert(getPropertyUpgradeStatus(eligible.property, eligible.player, NURSERY_EXPANDED_BENCHES_UPGRADE_ID).eligible, 'Qualified player must be eligible')
const beforeSlots = eligible.nurserySlots.map((slot) => slot)
const beforePlants = JSON.stringify(eligible.nurserySlots.map((slot) => slot.plant))
const beforeXp = JSON.stringify(eligible.player.skills)
const upgraded = gameStateReducer(eligible, { type: 'property/upgraded', upgradeId: NURSERY_EXPANDED_BENCHES_UPGRADE_ID, now: now + 1 })
assert(upgraded !== eligible, 'Valid upgrade must change state')
assert(upgraded.property.buildings.nursery.level === 2, 'Nursery must become Level 2')
assert(upgraded.property.buildings.nursery.upgradedAt === new Date(now + 1).toISOString(), 'Upgrade timestamp must be recorded')
assert(upgraded.player.tokens === eligible.player.tokens - 500, 'Upgrade must charge exactly 500 Tokens')
assert(upgraded.nurserySlots.length === 8 && getNurseryCapacity(upgraded.property) === 8, 'Level 2 must expose eight slots')
assert(beforeSlots.every((slot, index) => upgraded.nurserySlots[index] === slot), 'Existing slot objects must be preserved')
assert(JSON.stringify(upgraded.nurserySlots.slice(0, 6).map((slot) => slot.plant)) === beforePlants, 'Existing plants must remain unchanged')
assert(upgraded.nurserySlots.slice(6).every((slot) => slot.plant === null), 'New slots must be empty')
assert(JSON.stringify(upgraded.player.skills) === beforeXp, 'Property upgrades must not award XP')
assert(resolveWorldBuilding(farmLocations.find((building) => building.id === 'nursery')!, upgraded.property, upgraded.geneticsLab).label.includes('Lv. 2'), 'Farm label must update from property state')
assert(gameStateReducer(upgraded, { type: 'property/upgraded', upgradeId: NURSERY_EXPANDED_BENCHES_UPGRADE_ID, now: now + 2 }) === upgraded, 'Repeat purchase must be rejected')
assert(gameStateReducer(upgraded, { type: 'property/upgraded', upgradeId: 'nursery-propagation-house', now: now + 2 }) === upgraded, 'Unimplemented Level 3 must be rejected')
assert(gameStateReducer(eligible, { type: 'property/upgraded', upgradeId: 'lab-tier-1', now: now + 2 }) === eligible, 'Lab upgrades must not use property reducer')
assert(gameStateReducer(eligible, { type: 'property/upgraded', upgradeId: 'unknown', now: now + 2 }) === eligible, 'Unknown upgrade must be rejected')
assert(gameStateReducer(eligible, { type: 'property/upgraded', upgradeId: NURSERY_EXPANDED_BENCHES_UPGRADE_ID, now: Number.NaN }) === eligible, 'Malformed timestamp must be rejected')
const poor = { ...eligible, player: { ...eligible.player, tokens: 499 } }
assert(gameStateReducer(poor, { type: 'property/upgraded', upgradeId: NURSERY_EXPANDED_BENCHES_UPGRADE_ID, now: now + 2 }) === poor, 'Insufficient Tokens must be rejected atomically')

console.log('Property verification passed')
