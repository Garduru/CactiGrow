import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WorldNav } from '../components/layout/WorldNav'
import { InGameChatHud } from '../features/social/InGameChatHud'
import { useSocialPanel } from '../features/social/useSocialPanel'
import { createFarmReturnState, createTownFarmArrivalState, resolveFarmSpawnId } from '../app/farmReturnNavigation'
import { useGameState } from '../game/useGameState'
import { createFarmWorldProjection } from './farmWorldProjection'
import { FarmWorldHost } from './FarmWorldHost'
import type { WorldIntent } from './worldTypes'
import { getGardenPreview, subscribeGardenPreview } from '../features/devtools/worldDiagnostics'
import { useFeaturePanel } from '../features/menu/featurePanelState'
import { devToolsAvailable } from '../config/deploymentMode'
import { usePlantLifecycle } from '../app/usePlantLifecycle'
import { useGardenAuthority } from '../app/useGardenAuthority'

export function FarmWorldPage() {
  const { state } = useGameState()
  const lifecycle = usePlantLifecycle(); const garden = useGardenAuthority()
  const navigate = useNavigate()
  const location = useLocation()
  const spawnId = resolveFarmSpawnId(location.state)
  const testGardenDisplay = useSyncExternalStore(subscribeGardenPreview, getGardenPreview)
  const { openFeature } = useFeaturePanel()
  const social = useSocialPanel()
  const testEnabled = devToolsAvailable()
  useEffect(() => { if (testEnabled && new URLSearchParams(location.search).has('plantTest')) openFeature('devtools') }, [location.search, openFeature, testEnabled])
  const projection = useMemo(() => {
    const serverPlants = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection.ownedSpecimens : null
    const live = createFarmWorldProjection(state.property, state.geneticsLab, serverPlants ?? state.ownedPlants, garden.projection?.displayAssignments ?? state.gardenDisplayAssignments)
    if (!testEnabled || !testGardenDisplay) return live
    return { ...live, gardenDisplays: [...live.gardenDisplays.filter((display) => display.slotId !== testGardenDisplay.slotId), testGardenDisplay] }
  }, [garden.projection, lifecycle.state, state.geneticsLab, state.property, state.ownedPlants, state.gardenDisplayAssignments, testEnabled, testGardenDisplay])
  const handleIntent = useCallback((intent: WorldIntent) => {
    if (intent.type !== 'ENTER_LOCATION') return
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
    </section>
  )
}
