import type { StartingExperienceV1 } from '../../../shared/api/startingExperienceV1.ts'

export interface Guidance { target: string | null; instruction: string }
export interface GuidanceContext { path: string; areaId?: string; inventoryOpen: boolean; available: ReadonlySet<string> }
const idle: Guidance = { target: null, instruction: '' }
export function tutorialPlantRole(state: StartingExperienceV1 | null, id: string): string | null {
  return state?.tutorialParentIds[0] === id ? 'Your first San Pedro' : state?.tutorialParentIds[1] === id ? 'Practice partner' : null
}
export function resolveTutorialGuidance(state: StartingExperienceV1 | null, context: GuidanceContext): Guidance {
  if (!state || state.compatibilityComplete || state.farmTutorialComplete || !state.appearanceComplete) return idle
  const guide = (target: string | null, instruction: string): Guidance => ({ target, instruction })
  const facility = (id: string, instruction: string) => context.path === '/world' && context.areaId === 'player-farm'
    ? guide(`building:${id}`, instruction) : guide('farm-return', `Return to your Farm, then ${instruction.toLowerCase()}`)
  if (!state.spawnTutorialComplete) {
    switch (state.spawnStage) {
      case 'meet-guide': return guide('entity:mara-guide', 'Talk to Mara beside the path.')
      case 'equip-tool': return context.inventoryOpen ? guide('equip-tool', 'Equip your Field Knife in Equipment.') : guide('inventory', 'Open the backpack in the HUD to equip your Field Knife.')
      case 'harvest-cactus': return guide('entity:first-san-pedro', 'Harvest seeds from the wild San Pedro beside Mara.')
      case 'plant-pot': return context.areaId === 'path-1' ? guide('entity:path-1-pot', 'Plant your reserved seed in the Path 1 pot.') : guide('exit:to-path-1', 'Follow the eastern road to the Path 1 tutorial pot.')
      case 'collect-pot': return guide(null, 'Your quick demonstration plant is growing. Farm plants use normal schedules.')
      case 'collect-ready': return guide('entity:path-1-pot', 'Collect your first San Pedro from the Path 1 pot.')
      case 'leave-zone': return guide('exit:to-cross-path-1', 'Take the eastern opening to Cross Path.')
    }
  }
  if (state.farmStage === 'undiscovered') return guide('exit:to-player-farm', 'Visit your Farm through the northern Cross Path opening.')
  if (state.farmStage === 'nursery') return context.path === '/nursery'
    ? guide(context.available.has('nursery-seed') ? 'nursery-seed' : 'nursery-plant', state.farmSeedAvailable ? 'Plant your reserved Farm practice seed. Nursery plants grow on their normal schedule, even offline.' : 'Plant one normal seed. Nursery plants grow on their normal schedule, even offline.')
    : facility('nursery', 'Visit the Nursery.')
  if (state.farmStage === 'lab' && context.path === '/lab') return guide(null, 'Genetics Lab unlocks facilities. Basic Observation is performed on a specimen in Garden.')
  if (state.farmStage === 'lab') return facility('lab', 'Visit the Genetics Lab to learn about facilities and research unlocks.')
  if (context.path !== '/garden') return facility('garden', 'Enter the Garden to continue with your first San Pedro.')
  const first = state.tutorialParentIds[0], partner = state.tutorialParentIds[1]
  if (state.farmStage === 'garden') return guide(`favorite:${first}`, 'Favorite Your first San Pedro. Favorites protect specimens from sale and transfer.')
  if (state.farmStage === 'research') {
    if (context.available.has(`observe:${first}`)) return guide(`observe:${first}`, 'Choose Observe specimen to record Basic Observation.')
    if (context.available.has(`study:${first}`)) return guide(`study:${first}`, 'Choose Study Genetics for Your first San Pedro.')
    return guide(`details:${first}`, 'Open Details for Your first San Pedro, the plant you grew in Path 1.')
  }
  if (state.farmStage === 'breeding') {
    if (context.available.has('confirm-breeding')) return guide('confirm-breeding', 'Confirm breeding. Both parents stay in your Garden.')
    if (context.available.has(`partner:${partner}`)) return guide(`partner:${partner}`, 'Choose Practice partner to breed with Your first San Pedro.')
    if (context.available.has(`breed:${first}`)) return guide(`breed:${first}`, 'Choose Breed to pair Your first San Pedro with Practice partner.')
    return guide(`details:${first}`, 'Breed Your first San Pedro with Practice partner. Start with its Details.')
  }
  return idle
}
