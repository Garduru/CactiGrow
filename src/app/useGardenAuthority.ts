import { useContext } from 'react'
import { GardenAuthorityContext } from './GardenAuthorityContext.ts'
export function useGardenAuthority() { const value = useContext(GardenAuthorityContext); if (!value) throw new Error('useGardenAuthority requires GardenAuthorityProvider.'); return value }
