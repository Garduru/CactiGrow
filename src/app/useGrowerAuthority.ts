import { useContext } from 'react'
import { GrowerAuthorityContext } from './GrowerAuthorityContext'

export function useGrowerAuthority() {
  const value = useContext(GrowerAuthorityContext)
  if (!value) throw new Error('useGrowerAuthority must be used inside GrowerAuthorityProvider.')
  return value
}
