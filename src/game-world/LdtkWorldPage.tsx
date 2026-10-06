import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authoredRoadExit, discoveredTravelAreas, findArea, zoneName } from '../../shared/world/world.ts'
import { WorldNav } from '../components/layout/WorldNav'
import type { GameplayCameraState } from './gameplayCamera'
import type { WorldLocationId } from './worldTypes'
import { useWorldLocation } from './WorldLocationContext'
import { useSocialState } from '../features/social/useSocialState'
import { useSocialPanel } from '../features/social/useSocialPanel'
import { InGameChatHud } from '../features/social/InGameChatHud'
import { useGameState } from '../game/useGameState'
import { usePlantLifecycle } from '../app/usePlantLifecycle'
import { useGardenAuthority } from '../app/useGardenAuthority'
import { useFeaturePanel } from '../features/menu/featurePanelState'
import { createFarmReturnState, resolveFarmSpawnId } from '../app/farmReturnNavigation'
import { createFarmWorldProjection } from './farmWorldProjection'
import { townWorldProjection } from './townWorldProjection'
import { createFarmWorldGame } from './createFarmWorldGame'
import { createTownWorldGame } from './createTownWorldGame'
import { createLdtkWorldGame } from './createLdtkWorldGame'
import { PhaserWorldCanvas } from './PhaserWorldHost'
import { farmWorldSpawns } from './farmWorldLayout'
import type { WorldBridge } from './WorldBridge'
import type { WorldIntent } from './worldTypes'
import { useStartingExperience } from '../features/starting/StartingContext'
import { WorldTutorialDialog } from '../features/starting/WorldTutorialDialog'
function roadLabel(areaId: string) {
  const exit = authoredRoadExit(findArea(areaId)!)
  return `Road to ${exit?.targetAreaId ? findArea(exit.targetAreaId)?.displayName ?? 'unavailable route' : 'unavailable route'}`
}
const foundationTownProjection = { ...townWorldProjection, locations: townWorldProjection.locations.map(l => l.id === 'farm' ? { ...l, displayName: roadLabel('town-p1') } : l) }

export function LdtkWorldPage() {
  const world = useWorldLocation(), social = useSocialState(), dock = useSocialPanel(), route = useLocation(), navigate = useNavigate()
  const { state } = useGameState(), lifecycle = usePlantLifecycle(), garden = useGardenAuthority(), panels = useFeaturePanel()
  const tutorial = useStartingExperience(), [interaction, setInteraction] = useState<string | null>(null)
  const interactionRef = useRef(interaction), tutorialRef = useRef(tutorial)
  useEffect(() => { interactionRef.current = interaction; tutorialRef.current = tutorial }, [interaction, tutorial])
  const appearanceSkin = tutorial.state?.appearance.skin, appearanceShirt = tutorial.state?.appearance.shirt
  const actions = useRef(world)
  const camera = useRef<GameplayCameraState>({})
  useEffect(() => { actions.current = world }, [world])
  const location = world.location, area = location ? findArea(location.areaId) : undefined
  const farm = useMemo(() => {
    const plants = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection.ownedSpecimens : state.ownedPlants
    const p = createFarmWorldProjection(state.property, state.geneticsLab, plants, garden.projection?.displayAssignments ?? state.gardenDisplayAssignments)
    return { ...p, locations: p.locations.map(l => l.id === 'town' ? { ...l, displayName: roadLabel('player-farm') } : l) }
  }, [lifecycle.state, state.property, state.geneticsLab, state.ownedPlants, state.gardenDisplayAssignments, garden.projection])
  const projection = area?.areaType === 'farm' ? farm : area?.areaType === 'town' ? foundationTownProjection : { locations: [] }
  const position = area?.areaType === 'farm' && route.state?.worldSpawn && route.state.worldRevision === location?.revision ? farmWorldSpawns[resolveFarmSpawnId(route.state)] : location?.position
  const createGame = useCallback((parent: HTMLElement, bridge: WorldBridge) => {
    if (!area || !position) throw new Error('World location unavailable.')
    const foundation = { area, position, camera: camera.current, appearance: appearanceSkin == null || appearanceShirt == null ? undefined : { skin: appearanceSkin, shirt: appearanceShirt }, onInteract: (id: string) => setInteraction(id), tutorialPot: () => tutorialRef.current.state?.pot ?? null, debug: import.meta.env.MODE === 'staging' && new URLSearchParams(route.search).has('worldDebug'), pending: () => actions.current.pending || !!interactionRef.current || tutorialRef.current.pending, onExit: (id: string) => { void actions.current.transition(id) } }
    if (area.areaType === 'farm') return createFarmWorldGame(parent, bridge, { spawnId: 'default', foundation })
    if (area.areaType === 'town') return createTownWorldGame(parent, bridge, { spawnId: 'farm-arrival', connection: social.connection, foundation })
    return createLdtkWorldGame(parent, foundation)
  }, [area, position, social.connection, route.search, appearanceSkin, appearanceShirt])
  const intent = useCallback((intent: WorldIntent) => {
    if (intent.type === 'OPEN_PLAYER_PROFILE') { social.openProfile(intent.publicId); return }
    if (area?.areaType === 'farm') {
      if (intent.locationId === 'town') return // Outdoor roads activate only by walking into LDtk triggers.
      const destination = farm.locations.find(l => l.id === intent.locationId)
      if (destination && destination.id !== 'town') navigate(destination.route, { state: { ...createFarmReturnState(destination.id), worldReturnTo: '/world', worldRevision: world.location?.revision } })
    } else if (area?.areaType === 'town') {
      if (intent.locationId === 'shop' || intent.locationId === 'market') panels.openFeature(intent.locationId)
    }
  }, [area, farm.locations, navigate, panels, social, world])
  if (import.meta.env.MODE !== 'staging') return <Navigate to="/play" replace />
  if (!area || !location) return <section className="world-page"><p role="status">{world.error || 'Loading world…'}</p>{world.error && <button onClick={world.reload}>Retry</button>}</section>
  return <section className="world-page" aria-label={`${zoneName(area.zoneId)} · ${area.displayName}`}>
    <WorldNav<string> sceneName={area.displayName}
      destinations={[...(area.areaType === 'farm' ? farm.locations.filter(l => l.id !== 'town') : []), ...discoveredTravelAreas(location).map(a => ({ id: `world:${a.travelDestinationId}`, displayName: a.travelDisplayName ?? a.displayName }))]}
      onTravel={id => { interactionRef.current = null; setInteraction(null); if (id.startsWith('world:')) void world.travel(id.slice(6)); else intent({ type: 'ENTER_LOCATION', locationId: id as WorldLocationId }) }} />
    <div className="world-page__viewport">
      <PhaserWorldCanvas projection={projection} onIntent={intent} createGame={createGame} />
      <div className="town-multiplayer-status" role="status">{world.pending ? 'Travelling…' : world.error || `${zoneName(area.zoneId)} · ${area.displayName}`}{world.error && <button onClick={world.reload}>Reload location</button>}</div>
      {dock.chatDockExpanded && <InGameChatHud mode={dock.activeTab === 'friends' ? 'world-chat' : dock.activeTab} onModeChange={dock.setActiveTab} />}
      {interaction && area.interactables?.find(e => e.entityId === interaction) && <WorldTutorialDialog key={interaction} entity={area.interactables.find(e => e.entityId === interaction)!} close={() => setInteraction(null)} />}
    </div>
  </section>
}
