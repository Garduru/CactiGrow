import { useContext } from 'react'
import { SocialContext } from './socialContextState'

export function useSocialState() {
  const context = useContext(SocialContext)
  if (!context) throw new Error('useSocialState must be used inside SocialProvider.')
  return context
}