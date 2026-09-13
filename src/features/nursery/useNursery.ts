import { useEffect, useState } from 'react'
import {
  calculateNurseryGrowth,
  createInitialNurserySlots,
  createNurseryPlant,
  type NurseryPlant,
  type NurserySeedStack,
} from './nurseryModel'

const initialSeeds: NurserySeedStack[] = [
  { speciesId: 'echinopsis-pachanoi', quantity: 4 },
  { speciesId: 'lophophora-williamsii', quantity: 2 },
]

interface UseNurseryOptions {
  onCollect: (plant: NurseryPlant) => void
}

export function useNursery({ onCollect }: UseNurseryOptions) {
  const [now, setNow] = useState(() => Date.now())
  const [slots, setSlots] = useState(() => createInitialNurserySlots(Date.now()))
  const [seeds, setSeeds] = useState(initialSeeds)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function plantSeed(slotId: string, speciesId: string) {
    const seed = seeds.find((entry) => entry.speciesId === speciesId)
    const slot = slots.find((entry) => entry.id === slotId)
    if (!seed?.quantity || !slot || slot.plant) return false

    const plantedAt = Date.now()
    setSlots((current) => current.map((entry) => (
      entry.id === slotId
        ? { ...entry, plant: createNurseryPlant(speciesId, plantedAt) }
        : entry
    )))
    setSeeds((current) => current.map((entry) => (
      entry.speciesId === speciesId
        ? { ...entry, quantity: entry.quantity - 1 }
        : entry
    )))
    setNow(plantedAt)
    return true
  }

  function collectPlant(slotId: string) {
    const plant = slots.find((entry) => entry.id === slotId)?.plant
    if (!plant || !calculateNurseryGrowth(plant.plantedAt, Date.now()).isMature) return

    onCollect(plant)
    setSlots((current) => current.map((entry) => (
      entry.id === slotId ? { ...entry, plant: null } : entry
    )))
  }

  return { now, slots, seeds, plantSeed, collectPlant }
}
