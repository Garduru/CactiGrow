import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WorldNav } from '../components/layout/WorldNav'
import { InGameChatHud } from '../features/social/InGameChatHud'
import { useSocialPanel } from '../features/social/useSocialPanel'
import { createFarmReturnState, createTownFarmArrivalState, resolveFarmSpawnId } from '../app/farmReturnNavigation'
import { useGameState } from '../game/useGameState'
import { createFarmWorldProjection } from './farmWorldProjection'
import { FarmWorldHost } from './FarmWorldHost'
import type { GardenDisplayProjection, WorldIntent } from './worldTypes'
import { usePlantLifecycle } from '../app/usePlantLifecycle'
import { useGardenAuthority } from '../app/useGardenAuthority'

const PlantVisualTestTool = import.meta.env.DEV
  ? lazy(() => import('../dev/PlantVisualTestTool').then((module) => ({ default: module.PlantVisualTestTool })))
  : null

export function FarmWorldPage() {
  const { state } = useGameState()
  const lifecycle = usePlantLifecycle(); const garden = useGardenAuthority()
  const navigate = useNavigate()
  const location = useLocation()
  const spawnId = resolveFarmSpawnId(location.state)
  const [testGardenDisplay, setTestGardenDisplay] = useState<GardenDisplayProjection | null>(null)
  const social = useSocialPanel()
  const testEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('plantTest')
  const projection = useMemo(() => {
    const serverPlants = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection.ownedSpecimens : null
    const live = createFarmWorldProjection(state.property, state.geneticsLab, serverPlants ?? state.ownedPlants, garden.projection?.displayAssignments ?? state.gardenDisplayAssignments)
    if (!testEnabled || !testGardenDisplay) return live
    return { ...live, gardenDisplays: [...live.gardenDisplays.filter((display) => display.slotId !== testGardenDisplay.slotId), testGardenDisplay] }
  }, [garden.projection, lifecycle.state, state.geneticsLab, state.property, state.ownedPlants, state.gardenDisplayAssignments, testEnabled, testGardenDisplay])
  const handleIntent = useCallback((intent: WorldIntent) => {
    const destination = projection.locations.find((location) => location.id === intent.locationId)
    if (!destination) return
    if (destination.id === 'town') navigate('/town', { state: createTownFarmArrivalState() })
    else navigate(destination.route, { state: createFarmReturnState(destination.id) })
  }, [navigate, projection])

  return (
    <section className="world-page" aria-label="Farm">
      <WorldNav
        sceneName="Farm"
        destinations={projection.locations}
        onTravel={(locationId) => handleIntent({ type: 'ENTER_LOCATION', locationId })}
      />
      <div className="world-page__viewport">
        <FarmWorldHost projection={projection} onIntent={handleIntent} spawnId={spawnId} />
        {social.chatDockExpanded && (
          <InGameChatHud
            mode={social.activeTab === 'messages' ? 'messages' : 'world-chat'}
            onModeChange={social.setActiveTab}
          />
        )}
      </div>
      {testEnabled && PlantVisualTestTool && <Suspense fallback={null}><PlantVisualTestTool onGardenPreview={setTestGardenDisplay} /></Suspense>}
    </section>
  )
}
