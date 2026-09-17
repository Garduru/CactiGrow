import { useCallback, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createFarmReturnState, createTownFarmArrivalState, resolveFarmSpawnId } from '../app/farmReturnNavigation'
import { useGameState } from '../game/useGameState'
import { createFarmWorldProjection } from './farmWorldProjection'
import { FarmWorldHost } from './FarmWorldHost'
import type { WorldIntent } from './worldTypes'

export function FarmWorldPage() {
  const { state } = useGameState()
  const navigate = useNavigate()
  const location = useLocation()
  const spawnId = resolveFarmSpawnId(location.state)
  const projection = useMemo(() => createFarmWorldProjection(state.property, state.geneticsLab), [state.geneticsLab, state.property])
  const handleIntent = useCallback((intent: WorldIntent) => {
    const destination = projection.locations.find((location) => location.id === intent.locationId)
    if (!destination) return
    if (destination.id === 'town') navigate('/town', { state: createTownFarmArrivalState() })
    else navigate(destination.route, { state: createFarmReturnState(destination.id) })
  }, [navigate, projection])

  return (
    <section className="world-page" aria-labelledby="world-page-title">
      <header className="world-page__header"><h1 id="world-page-title">Farm</h1></header>
      <p className="world-page__instructions">Move with WASD or arrow keys, or click/tap the ground. Press E or click/tap a nearby building to enter.</p>
      <FarmWorldHost projection={projection} onIntent={handleIntent} spawnId={spawnId} />
      <nav className="world-page__fallback" aria-label="Farm destinations">
        {projection.locations.map((location) => <Link key={location.id} to={location.route} state={location.id === 'town' ? createTownFarmArrivalState() : createFarmReturnState(location.id)}>{location.displayName}</Link>)}
      </nav>
    </section>
  )
}
