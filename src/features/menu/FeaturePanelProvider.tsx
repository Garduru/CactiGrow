import { useCallback, useState, type ReactNode } from 'react'
import { FeaturePanelContext, type FeatureId } from './featurePanelState'
import { devToolsAvailable } from '../../config/deploymentMode'
import { useAdminAccess } from '../admin/adminAccess'

export function FeaturePanelProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<FeatureId | null>(null)
  const [worldPreview, setPreview] = useState(false)
  const [travelHost, setTravelHost] = useState<HTMLDivElement | null>(null)
  const { session } = useAdminAccess()
  const adminAvailable = !!session?.permissions.includes('admin.access')
  const openFeature = useCallback((next: FeatureId) => { if ((next !== 'devtools' || devToolsAvailable()) && (next !== 'admintools' || adminAvailable)) { setPreview(false); setFeature(next) } }, [adminAvailable])
  const closeFeature = useCallback(() => { setPreview(false); setFeature(null) }, [])
  const setWorldPreview = useCallback((enabled: boolean) => setPreview(enabled && feature === 'devtools' && devToolsAvailable()), [feature])
  return <FeaturePanelContext.Provider value={{ feature, openFeature, closeFeature, worldPreview, setWorldPreview, travelHost, setTravelHost }}>{children}</FeaturePanelContext.Provider>
}
