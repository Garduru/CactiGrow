import { useCallback, useState, type ReactNode } from 'react'
import { FeaturePanelContext, type FeatureId } from './featurePanelState'

export function FeaturePanelProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<FeatureId | null>(null)
  const [travelHost, setTravelHost] = useState<HTMLDivElement | null>(null)
  const openFeature = useCallback((next: FeatureId) => setFeature(next), [])
  const closeFeature = useCallback(() => setFeature(null), [])
  return <FeaturePanelContext.Provider value={{ feature, openFeature, closeFeature, travelHost, setTravelHost }}>{children}</FeaturePanelContext.Provider>
}
