import { createContext } from 'react'

export type SocialPanelTab = 'friends' | 'messages' | 'world-chat'

export interface SocialPanelContextValue {
  open: boolean
  activeTab: SocialPanelTab
  chatDockExpanded: boolean
  openPanel: (tab: SocialPanelTab) => void
  closePanel: () => void
  setActiveTab: (tab: SocialPanelTab) => void
  setChatDockExpanded: (expanded: boolean) => void
}

export const SocialPanelContext = createContext<SocialPanelContextValue | null>(null)
