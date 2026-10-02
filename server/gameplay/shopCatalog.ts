// Shop V1 sells only the two existing commodity seeds. Prices are system-owned.
export const SHOP_CATALOG = [
  { id: 'san-pedro-seed', speciesId: 'echinopsis-pachanoi', name: 'San Pedro seeds', description: 'Normal San Pedro seeds for your Nursery.', price: 25 },
  { id: 'peyote-seed', speciesId: 'lophophora-williamsii', name: 'Peyote seeds', description: 'Normal Peyote seeds for your Nursery.', price: 75 },
] as const
export const MAX_SHOP_QUANTITY = 100
export const MAX_ECONOMY_INTEGER = 2_147_483_647
