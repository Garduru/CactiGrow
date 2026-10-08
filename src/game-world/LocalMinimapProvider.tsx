import { useState, type ReactNode } from 'react'
import { LocalMinimapStore } from './localMinimap'
import { LocalMinimapContext } from './LocalMinimapContext'
export function LocalMinimapProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new LocalMinimapStore()), [open, setOpen] = useState(false)
  const toggle = () => setOpen(store.toggleOpen())
  return <LocalMinimapContext.Provider value={{ store, open, toggle }}>{children}</LocalMinimapContext.Provider>
}
