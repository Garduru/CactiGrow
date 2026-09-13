export type FarmLocationId = 'nursery' | 'garden' | 'shop' | 'market'

interface FarmLocation {
  id: FarmLocationId
  label: string
  to: string
  description: string
}

export const farmLocations: readonly FarmLocation[] = [
  { id: 'nursery', label: 'Nursery', to: '/nursery', description: 'From tiny seeds to new growth' },
  { id: 'garden', label: 'Garden', to: '/garden', description: 'Your own little cactus sanctuary' },
  { id: 'shop', label: 'Shop', to: '/shop', description: 'Seeds, supplies & possibilities' },
  { id: 'market', label: 'Marketplace', to: '/market', description: 'Find something extraordinary' },
]
