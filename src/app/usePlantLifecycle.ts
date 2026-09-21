import { useContext } from 'react'
import { PlantLifecycleContext } from './PlantLifecycleContext'
export function usePlantLifecycle() { const value = useContext(PlantLifecycleContext); if (!value) throw new Error('usePlantLifecycle must be used within PlantLifecycleProvider.'); return value }
