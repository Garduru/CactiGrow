import { useCallback, useState, type ReactNode } from 'react'
import { FeaturePanelContext, type FeatureId } from './featurePanelState'
import { devToolsAvailable } from '../../config/deploymentMode'

export function FeaturePanelProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<FeatureId | null>(null)
  const [worldPreview, setPreview] = useState(false)
  const [travelHost, setTravelHost] = useState<HTMLDivElement | null>(null)
  const openFeature = useCallback((next: FeatureId) => { if (next !== 'devtools' || devToolsAvailable()) { setPreview(false); setFeature(next) } }, [])
  const closeFeature = useCallback(() => { setPreview(false); setFeature(null) }, [])
  const setWorldPreview = useCallback((enabled: boolean) => setPreview(enabled && feature === 'devtools' && devToolsAvailable()), [feature])
  return <FeaturePanelContext.Provider value={{ feature, openFeature, closeFeature, worldPreview, setWorldPreview, travelHost, setTravelHost }}>{children}</FeaturePanelContext.Provider>
}
