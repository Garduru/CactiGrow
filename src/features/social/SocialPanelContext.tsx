import { useCallback, useState, type ReactNode } from 'react'
import { SocialPanelContext, type SocialPanelTab } from './socialPanelState'
import { useFeaturePanel } from '../menu/featurePanelState'

export function SocialPanelProvider({ children }: { children: ReactNode }) {
  const { openFeature } = useFeaturePanel()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SocialPanelTab>('world-chat')
  const [chatDockExpanded, setChatDockExpanded] = useState(false)
  const openPanel = useCallback((tab: SocialPanelTab) => {
    if (tab === 'friends') { setOpen(false); openFeature('friends'); return }
    setActiveTab(tab); setOpen(true)
  }, [openFeature])
  const closePanel = useCallback(() => setOpen(false), [])

  return <SocialPanelContext.Provider value={{
    open, activeTab, chatDockExpanded,
    openPanel,
    closePanel,
    setActiveTab,
    setChatDockExpanded,
  }}>{children}</SocialPanelContext.Provider>
}
