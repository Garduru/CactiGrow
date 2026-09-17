import { useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createFarmTownRoadEntryState, createTownReturnState, resolveTownSpawnId } from '../app/farmReturnNavigation'
import { createTownWorldGame } from './createTownWorldGame'
import { PhaserWorldHost } from './PhaserWorldHost'
import { townWorldProjection } from './townWorldProjection'
import type { WorldIntent } from './worldTypes'

export function TownWorldPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const spawnId = resolveTownSpawnId(location.state)
  const handleIntent = useCallback((intent: WorldIntent) => {
    const destination = townWorldProjection.locations.find((location) => location.id === intent.locationId)
    if (!destination) return
    if (destination.id === 'farm') navigate('/', { state: createFarmTownRoadEntryState() })
    else navigate(destination.route, { state: createTownReturnState(destination.id) })
  }, [navigate])
  const createGame = useCallback((parent: HTMLElement, bridge: Parameters<typeof createTownWorldGame>[1], editor?: Parameters<typeof createTownWorldGame>[2]['editor']) => createTownWorldGame(parent, bridge, { spawnId, editor }), [spawnId])

  return (
    <section className="world-page" aria-labelledby="town-world-title">
      <header className="world-page__header">
        <div><span className="eyebrow">Presentation graybox</span><h1 id="town-world-title">Town</h1></div>
        <div className="world-page__actions"><Link className="cg-button cg-button--ghost" to="/" state={createFarmTownRoadEntryState()}>Return to Farm</Link></div>
      </header>
      <p className="world-page__instructions">Move with WASD or arrow keys, or click/tap the ground. Press E or click/tap a nearby destination to enter.</p>
      <PhaserWorldHost projection={townWorldProjection} onIntent={handleIntent} createGame={createGame} world="town" />
      <nav className="world-page__fallback" aria-label="Town destinations">
        <Link to="/shop" state={createTownReturnState('shop')}>Shop</Link>
        <Link to="/market" state={createTownReturnState('market')}>Marketplace / Exchange</Link>
        <Link to="/" state={createFarmTownRoadEntryState()}>Road to Farm</Link>
      </nav>
    </section>
  )
}
