import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPhaserPreviewReturnState } from '../app/farmReturnNavigation'
import { useGameState } from '../game/useGameState'
import { createFarmWorldProjection } from './farmWorldProjection'
import { FarmWorldHost } from './FarmWorldHost'
import type { WorldIntent } from './worldTypes'

export function FarmWorldPreviewPage() {
  const { state } = useGameState()
  const navigate = useNavigate()
  const projection = useMemo(() => createFarmWorldProjection(state.property, state.geneticsLab), [state.geneticsLab, state.property])
  const handleIntent = useCallback((intent: WorldIntent) => {
    const destination = projection.locations.find((location) => location.id === intent.locationId)
    if (destination) navigate(destination.route, { state: createPhaserPreviewReturnState() })
  }, [navigate, projection])

  return (
    <section className="world-preview" aria-labelledby="world-preview-title">
      <header className="world-preview__header">
        <div><span className="eyebrow">Renderer milestone</span><h1 id="world-preview-title">Farm graybox</h1></div>
        <Link className="cg-button cg-button--ghost" to="/">Back to React Farm</Link>
      </header>
      <p className="world-preview__instructions">Move with WASD or arrow keys, or click/tap the ground. Press E or click/tap a nearby building to enter.</p>
      <FarmWorldHost projection={projection} onIntent={handleIntent} />
      <nav className="world-preview__fallback" aria-label="Farm test destinations">
        {projection.locations.map((location) => <Link key={location.id} to={location.route} state={createPhaserPreviewReturnState()}>{location.displayName}</Link>)}
      </nav>
    </section>
  )
}
