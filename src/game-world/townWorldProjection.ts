import { CANONICAL_FARM_PATH } from '../app/farmReturnNavigation'
import type { TownWorldProjection } from './worldTypes'

export const townWorldProjection: TownWorldProjection = {
  locations: [
    { id: 'shop', displayName: 'Shop', route: '/shop', interactionLabel: 'Enter' },
    { id: 'market', displayName: 'Marketplace / Exchange', travelLabel: 'Marketplace', route: '/market', interactionLabel: 'Enter' },
    { id: 'farm', displayName: 'Road to Farm', route: CANONICAL_FARM_PATH, interactionLabel: 'Travel' },
  ],
}
