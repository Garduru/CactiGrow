import { useContext } from 'react'
import { PlayerBootstrapContext } from './PlayerBootstrapContext'

export function usePlayerBootstrap() {
  const context = useContext(PlayerBootstrapContext)
  if (!context) throw new Error('usePlayerBootstrap must be used within PlayerBootstrapProvider.')
  return context
}
