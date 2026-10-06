import { worldInputBoundary } from './worldInputBoundary'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFeaturePanel } from '../../features/menu/featurePanelState'
import type { WorldLocationId, WorldLocationProjection } from '../../game-world/worldTypes'

type OpenSurface = 'travel' | null

interface WorldNavProps<T extends string> {
  sceneName: string
  destinations?: readonly (Pick<WorldLocationProjection, 'displayName' | 'travelLabel'> & { id: T })[]
  onTravel?: (locationId: T) => void
}

export function WorldNav<T extends string = WorldLocationId>({
  sceneName,
  destinations,
  onTravel,
}: WorldNavProps<T>) {
  const { travelHost } = useFeaturePanel()
  const [openSurface, setOpenSurface] = useState<OpenSurface>(null)
  const containerRef = useRef<HTMLElement>(null)
  const travelToggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!openSurface) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpenSurface(null)
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation()
      setOpenSurface(null)
      requestAnimationFrame(() => travelToggleRef.current?.focus())
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape, true)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape, true)
    }
  }, [openSurface])

  return travelHost && createPortal(
    <nav {...worldInputBoundary} className="world-nav" ref={containerRef} aria-label={`${sceneName} world navigation`}>
      {destinations && onTravel && (
        <div className="world-nav__group">
          <div className="world-nav__travel">
            <button
              className="world-nav__control"
              ref={travelToggleRef}
              type="button"
              aria-expanded={openSurface === 'travel'}
              aria-controls={openSurface === 'travel' ? 'world-travel-menu' : undefined}
              onClick={() => setOpenSurface(openSurface === 'travel' ? null : 'travel')}
            >
              Travel
            </button>
            {openSurface === 'travel' && (
              <div className="world-nav__popover world-travel" id="world-travel-menu" aria-label={`${sceneName} travel destinations`}>
                {!destinations.length && <p>Visit a major destination to unlock Travel.</p>}
                {destinations.map((destination) => (
                  <button
                    key={destination.id}
                    type="button"
                    onClick={() => {
                      setOpenSurface(null)
                      onTravel(destination.id)
                    }}
                  >
                    {destination.travelLabel ?? destination.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>, travelHost
  )
}
