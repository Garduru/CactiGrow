import { GARDEN_ORGANIZED_BEDS_UPGRADE_ID, propertyUpgrades } from '../src/features/property/propertyConfig'
import { filterAndSortGardenPlants, MAX_GARDEN_TAG_LENGTH, MAX_GARDEN_TAGS_PER_SPECIMEN } from '../src/features/garden/gardenOrganizationModel'
import { XP_THRESHOLDS } from '../src/features/progression/progressionModel'
import { farmLocations, resolveWorldBuilding } from '../src/features/farm/locations'
import { createInitialGameState, gameStateReducer, type CollectedPlant } from '../src/game/gameState'
import { createMarketplaceListing } from '../src/features/marketplace/marketplaceModel'
import { getNpcSaleValue } from '../src/features/marketplace/sellModel'
import type { GardenFilters } from '../src/types/garden'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function specimen(id: string, speciesId = 'echinopsis-pachanoi'): CollectedPlant { return { id, ownerId: 'local-player', speciesId, cloneLineId: `clone-${id}`, stage: 'mature', plantedAt: '2026-01-01T00:00:00.000Z', collectedAt: `2026-01-0${id === 'a' ? 2 : 3}T00:00:00.000Z`, lastUpdatedAt: '2026-01-03T00:00:00.000Z', genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }, geneticFeatures: [], specialVariants: [], isHarvestable: false, isListedForSale: false } }

const now = Date.UTC(2026, 0, 1)
const first = specimen('a')
const second = { ...specimen('b', 'lophophora-williamsii'), isHybrid: true, specialVariants: [{ variantId: 'shiny' as const, origin: 'random' as const, establishedAt: '2026-01-01T00:00:00.000Z' }] }
const base = { ...createInitialGameState(now), ownedPlants: [first, second] }
assert(base.property.buildings.garden.level === 1, 'Garden must start at Level 1')
assert(gameStateReducer(base, { type: 'garden/favorite-set', plantId: first.id, favorite: true }) === base, 'Level 1 must reject organization actions')
const tokensBefore = base.player.tokens
assert(gameStateReducer(base, { type: 'property/upgraded', upgradeId: GARDEN_ORGANIZED_BEDS_UPGRADE_ID, now }) === base && base.player.tokens === tokensBefore, 'Below-level purchase must lose no Tokens')
const qualified = { ...base, player: { ...base.player, skills: { ...base.player.skills, cultivation: { xp: XP_THRESHOLDS[9] } } } }
const poor = { ...qualified, player: { ...qualified.player, tokens: 549 } }
assert(gameStateReducer(poor, { type: 'property/upgraded', upgradeId: GARDEN_ORGANIZED_BEDS_UPGRADE_ID, now }) === poor, 'Insufficient funds must lose no Tokens')
const xpBefore = JSON.stringify(qualified.player.skills)
const upgraded = gameStateReducer(qualified, { type: 'property/upgraded', upgradeId: GARDEN_ORGANIZED_BEDS_UPGRADE_ID, now })
assert(propertyUpgrades.find((entry) => entry.id === GARDEN_ORGANIZED_BEDS_UPGRADE_ID)?.tokenCost === 550, 'Garden cost must remain centralized at 550')
assert(upgraded.property.buildings.garden.level === 2 && upgraded.player.tokens === qualified.player.tokens - 550, 'Purchase must atomically charge once and advance Garden')
assert(JSON.stringify(upgraded.player.skills) === xpBefore, 'Purchase must award no XP')
assert(gameStateReducer(upgraded, { type: 'property/upgraded', upgradeId: GARDEN_ORGANIZED_BEDS_UPGRADE_ID, now: now + 1 }) === upgraded, 'Repeat purchase must be rejected')
assert(gameStateReducer(upgraded, { type: 'property/upgraded', upgradeId: 'garden-breeders-garden', now: now + 1 }) === upgraded, 'Garden Level 3 must remain unavailable')

const geneticsBefore = JSON.stringify(first.genetics)
const favorite = gameStateReducer(upgraded, { type: 'garden/favorite-set', plantId: first.id, favorite: true })
assert(favorite.gardenOrganization[first.id].favorite && JSON.stringify(favorite.ownedPlants[0].genetics) === geneticsBefore, 'Favorite must not change genetic truth')
const unfavorite = gameStateReducer(favorite, { type: 'garden/favorite-set', plantId: first.id, favorite: false })
assert(!unfavorite.gardenOrganization[first.id].favorite, 'Favorite must be removable')
const tagged = gameStateReducer(favorite, { type: 'garden/tag-added', plantId: first.id, tag: '  Breeders  ' })
assert(tagged.gardenOrganization[first.id].tags[0] === 'Breeders', 'Tag must be trimmed')
assert(gameStateReducer(tagged, { type: 'garden/tag-added', plantId: first.id, tag: 'breeders' }) === tagged, 'Case-normalized duplicate must be rejected')
assert(gameStateReducer(tagged, { type: 'garden/tag-added', plantId: first.id, tag: '   ' }) === tagged, 'Empty tag must be rejected')
assert(gameStateReducer(tagged, { type: 'garden/tag-added', plantId: first.id, tag: 'x'.repeat(MAX_GARDEN_TAG_LENGTH + 1) }) === tagged, 'Long tag must be rejected')
let capped = tagged
for (let index = 1; index < MAX_GARDEN_TAGS_PER_SPECIMEN; index += 1) capped = gameStateReducer(capped, { type: 'garden/tag-added', plantId: first.id, tag: `Tag ${index}` })
assert(gameStateReducer(capped, { type: 'garden/tag-added', plantId: first.id, tag: 'Overflow' }) === capped, 'Per-specimen tag limit must be enforced')
const removed = gameStateReducer(tagged, { type: 'garden/tag-removed', plantId: first.id, tag: 'BREEDERS' })
assert(removed.gardenOrganization[first.id].tags.length === 0, 'Tag removal must use normalized comparison')

const all: GardenFilters = { favoriteOnly: false, speciesId: '', tag: '', listing: 'all', special: 'all' }
assert(filterAndSortGardenPlants(tagged.ownedPlants, tagged.gardenOrganization, { ...all, favoriteOnly: true }, 'recent').map((plant) => plant.id).join() === first.id, 'Favorite filter must work')
assert(filterAndSortGardenPlants(tagged.ownedPlants, tagged.gardenOrganization, { ...all, speciesId: second.speciesId }, 'recent')[0].id === second.id, 'Species filter must work')
assert(filterAndSortGardenPlants(tagged.ownedPlants, tagged.gardenOrganization, { ...all, tag: 'breeders' }, 'recent')[0].id === first.id, 'Tag filter must normalize comparison')
const listedPlants = [first, { ...second, isListedForSale: true }]
assert(filterAndSortGardenPlants(listedPlants, tagged.gardenOrganization, { ...all, listing: 'listed' }, 'recent')[0].id === second.id, 'Listing filter must work')
assert(filterAndSortGardenPlants(listedPlants, tagged.gardenOrganization, { ...all, special: 'shiny' }, 'recent')[0].id === second.id && filterAndSortGardenPlants(listedPlants, tagged.gardenOrganization, { ...all, special: 'hybrid' }, 'recent')[0].id === second.id, 'Special filters must use only visible Shiny and known hybrid state')
assert(filterAndSortGardenPlants(tagged.ownedPlants, tagged.gardenOrganization, all, 'recent').map((plant) => plant.id).join() === 'b,a', 'Recent sorting must be deterministic')

const listing = createMarketplaceListing(first, tagged.player.id, 100, now)!
const listed = gameStateReducer(tagged, { type: 'marketplace/listed', listing })
assert(listed.gardenOrganization[first.id].favorite && listed.gardenOrganization[first.id].tags[0] === 'Breeders', 'Listing must preserve organization metadata')
const saleValue = getNpcSaleValue(first)!
const sold = gameStateReducer(tagged, { type: 'plant/sold-to-npc', plantId: first.id, expectedValue: saleValue, now })
assert(!sold.ownedPlants.some((plant) => plant.id === first.id) && !sold.gardenOrganization[first.id], 'Permanent ownership removal must clear organization metadata')
assert(resolveWorldBuilding(farmLocations.find((entry) => entry.id === 'garden')!, upgraded.property, upgraded.geneticsLab).label.includes('Lv. 2'), 'Farm label must derive Garden Level 2')

console.log('Garden verification passed')
