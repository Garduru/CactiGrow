export const XP_REWARDS = {
  plantSeed: 10,
  plantBredSeed: 15,
  collectPlant: 25,
  breedPlant: 40,
  npcSale: 15,
  marketplaceListing: 10,
} as const

export type XpRewardSource = keyof typeof XP_REWARDS
