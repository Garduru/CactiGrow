import { createContext, useContext } from 'react'

export const featureTitles = {
  shop: 'Shop', market: 'Marketplace', inventory: 'Inventory', profile: 'My Profile', friends: 'Friends', skills: 'Skills',
  journal: 'Journal', research: 'Research', achievements: 'Achievements', mail: 'Mail',
  settings: 'Settings', help: 'Help', signout: 'Sign Out',
  devtools: 'CactiGrow Dev Tools',
} as const
export type FeatureId = keyof typeof featureTitles
interface FeaturePanelState {
  feature: FeatureId | null
  openFeature(feature: FeatureId): void
  closeFeature(): void
  worldPreview: boolean
  setWorldPreview(enabled: boolean): void
  travelHost: HTMLDivElement | null
  setTravelHost(host: HTMLDivElement | null): void
}
export const FeaturePanelContext = createContext<FeaturePanelState | null>(null)
export function useFeaturePanel() {
  const context = useContext(FeaturePanelContext)
  if (!context) throw new Error('useFeaturePanel must be used inside FeaturePanelProvider.')
  return context
}
