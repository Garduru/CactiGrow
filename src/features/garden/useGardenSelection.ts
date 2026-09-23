import { useCallback, useMemo, useState } from 'react'

interface UseGardenSelectionReturn {
  selectedIds: Set<string>
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  clear: () => void
  remove: (ids: ReadonlySet<string>) => void
  exit: () => void
  selectedCount: number
}

/**
 * Client-side temporary selection state for Garden specimen cards.
 *
 * Selection is scoped to the consuming component's session.
 * Stale IDs are reconciled against the complete owned-specimen set
 * supplied by the caller on each render.
 */
export function useGardenSelection(ownedIds: Set<string>): UseGardenSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filtering the cards must not change ownership or selection.
  const reconciledIds = useMemo(() => {
    return new Set([...selectedIds].filter((id) => ownedIds.has(id)))
  }, [selectedIds, ownedIds])

  const isSelected = useCallback((id: string) => reconciledIds.has(id), [reconciledIds])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])
  const remove = useCallback((ids: ReadonlySet<string>) => {
    setSelectedIds((previous) => new Set([...previous].filter((id) => !ids.has(id))))
  }, [])

  const exit = useCallback(() => {
    clear()
  }, [clear])

  return {
    selectedIds: reconciledIds,
    isSelected,
    toggle,
    clear,
    remove,
    exit,
    selectedCount: reconciledIds.size,
  }
}
