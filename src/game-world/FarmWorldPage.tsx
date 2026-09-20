import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WorldHud } from '../components/layout/WorldHud'
import { createFarmReturnState, createTownFarmArrivalState, resolveFarmSpawnId } from '../app/farmReturnNavigation'
import { useGameState } from '../game/useGameState'
import { createFarmWorldProjection } from './farmWorldProjection'
import { FarmWorldHost } from './FarmWorldHost'
import type { GardenDisplayProjection, WorldIntent } from './worldTypes'

const PlantVisualTestTool = import.meta.env.DEV
  ? lazy(() => import('../dev/PlantVisualTestTool').then((module) => ({ default: module.PlantVisualTestTool })))
  : null

export function FarmWorldPage() {
  const { state } = useGameState()
  const navigate = useNavigate()
  const location = useLocation()
  const spawnId = resolveFarmSpawnId(location.state)
  const [testGardenDisplay, setTestGardenDisplay] = useState<GardenDisplayProjection | null>(null)
  const testEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('plantTest')
  const projection = useMemo(() => {
    const live = createFarmWorldProjection(state.property, state.geneticsLab, state.ownedPlants, state.gardenDisplayAssignments)
    if (!testEnabled || !testGardenDisplay) return live
    return { ...live, gardenDisplays: [...live.gardenDisplays.filter((display) => display.slotId !== testGardenDisplay.slotId), testGardenDisplay] }
  }, [state.geneticsLab, state.property, state.ownedPlants, state.gardenDisplayAssignments, testEnabled, testGardenDisplay])
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
      <div className="world-page__viewport">
        <FarmWorldHost projection={projection} onIntent={handleIntent} spawnId={spawnId} />
        <WorldHud
          sceneName="Farm"
          destinations={projection.locations}
          onTravel={(locationId) => handleIntent({ type: 'ENTER_LOCATION', locationId })}
        />
      </div>
      {testEnabled && PlantVisualTestTool && <Suspense fallback={null}><PlantVisualTestTool onGardenPreview={setTestGardenDisplay} /></Suspense>}
    </section>
  )
}
