import type { TownWorldProjection } from './worldTypes'

export const townWorldProjection: TownWorldProjection = {
  locations: [
    { id: 'shop', displayName: 'Shop', route: '/shop', interactionLabel: 'Enter' },
    { id: 'market', displayName: 'Marketplace / Exchange', route: '/market', interactionLabel: 'Enter' },
    { id: 'farm', displayName: 'Road to Farm', route: '/', interactionLabel: 'Travel' },
  ],
}
