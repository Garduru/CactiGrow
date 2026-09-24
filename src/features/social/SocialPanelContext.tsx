import { useCallback, useState, type ReactNode } from 'react'
import { SocialPanelContext, type SocialPanelTab } from './socialPanelState'

export function SocialPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SocialPanelTab>('world-chat')
  const [chatDockExpanded, setChatDockExpanded] = useState(false)
  const openPanel = useCallback((tab: SocialPanelTab) => { setActiveTab(tab); setOpen(true) }, [])
  const closePanel = useCallback(() => setOpen(false), [])

  return <SocialPanelContext.Provider value={{
    open, activeTab, chatDockExpanded,
    openPanel,
    closePanel,
    setActiveTab,
    setChatDockExpanded,
  }}>{children}</SocialPanelContext.Provider>
}
