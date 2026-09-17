import { useContext } from 'react'
import { SocialPanelContext } from './socialPanelState'

export function useSocialPanel() {
  const context = useContext(SocialPanelContext)
  if (!context) throw new Error('SocialPanelProvider is required')
  return context
}
