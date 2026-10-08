import { LocalMinimap } from './LocalMinimapView'
import { useLocalMinimap } from './LocalMinimapContext'
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
import { useTutorialGuidance } from '../features/starting/TutorialGuidanceContext'
import { useStartingExperience } from '../features/starting/StartingContext'
import { WorldTutorialDialog } from '../features/starting/WorldTutorialDialog'
import { useExploration } from '../features/exploration/ExplorationContext'
import { ExplorationNotice } from '../features/exploration/ExplorationNotice'
import type { WorldPoint } from '../../shared/world/types.ts'
import { FIELD_SURVEY } from '../../shared/api/fieldSurveyV1.ts'
import { FieldSurveyDialog } from '../features/field-survey/FieldSurveyDialog'
function roadLabel(areaId: string) {
  const exit = authoredRoadExit(findArea(areaId)!)
  return `Road to ${exit?.targetAreaId ? findArea(exit.targetAreaId)?.displayName ?? 'unavailable route' : 'unavailable route'}`
}
const foundationTownProjection = { ...townWorldProjection, locations: townWorldProjection.locations.map(l => l.id === 'farm' ? { ...l, displayName: roadLabel('town-p1') } : l) }

export function LdtkWorldPage() {
  const world = useWorldLocation(), social = useSocialState(), dock = useSocialPanel(), route = useLocation(), navigate = useNavigate()
  const { state } = useGameState(), lifecycle = usePlantLifecycle(), garden = useGardenAuthority(), panels = useFeaturePanel()
  const tutorial = useStartingExperience(), [interaction, setInteraction] = useState<string | null>(null)
  const [interactionPoint, setInteractionPoint] = useState<WorldPoint | null>(null)
  const exploration = useExploration(), explorationRef = useRef(exploration)
  const fieldRequest = useRef(false)
  useEffect(() => { explorationRef.current = exploration }, [exploration])
  const interactionRef = useRef(interaction), tutorialRef = useRef(tutorial)
  useEffect(() => { interactionRef.current = interaction; tutorialRef.current = tutorial }, [interaction, tutorial])
  const guidance = useTutorialGuidance(), guidanceRef = useRef(guidance.target)
  useEffect(() => { guidanceRef.current = guidance.target }, [guidance.target])
  const minimap = useLocalMinimap(), minimapStore = minimap?.store
  const savedAppearance = tutorial.state?.appearance
  const skin = savedAppearance?.skin, shirt = savedAppearance?.shirt
  const body = savedAppearance?.body ?? 0, hair = savedAppearance?.hair ?? 0, hairColor = savedAppearance?.hairColor ?? 0
  const pants = savedAppearance?.pants ?? 0, hat = savedAppearance?.hat ?? 0, accessory = savedAppearance?.accessory ?? 0
  // Tutorial projection refreshes must not remount Phaser while the look is unchanged.
  const appearance = useMemo(() => skin == null || shirt == null ? undefined : { skin, shirt, body, hair, hairColor, pants, hat, accessory }, [skin, shirt, body, hair, hairColor, pants, hat, accessory])
  const actions = useRef(world)
  const camera = useRef<GameplayCameraState>({})
  useEffect(() => { actions.current = world }, [world])
  const location = world.location, authoredArea = location ? findArea(location.areaId) : undefined
  const farmTutorialComplete = !!tutorial.state?.farmTutorialComplete
  const area = useMemo(() => authoredArea?.areaId === FIELD_SURVEY.npcAreaId && !farmTutorialComplete
    ? { ...authoredArea, interactables: authoredArea.interactables?.filter(entity => entity.entityId !== FIELD_SURVEY.npcEntityId) }
    : authoredArea, [authoredArea, farmTutorialComplete])
  const farm = useMemo(() => {
    const plants = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection.ownedSpecimens : state.ownedPlants
    const p = createFarmWorldProjection(state.property, state.geneticsLab, plants, garden.projection?.displayAssignments ?? state.gardenDisplayAssignments)
    return { ...p, locations: p.locations.map(l => l.id === 'town' ? { ...l, displayName: roadLabel('player-farm') } : l) }
  }, [lifecycle.state, state.property, state.geneticsLab, state.ownedPlants, state.gardenDisplayAssignments, garden.projection])
  const projection = area?.areaType === 'farm' ? farm : area?.areaType === 'town' ? foundationTownProjection : { locations: [] }
  const position = area?.areaType === 'farm' && route.state?.worldSpawn && route.state.worldRevision === location?.revision ? farmWorldSpawns[resolveFarmSpawnId(route.state)] : location?.position
  const createGame = useCallback((parent: HTMLElement, bridge: WorldBridge) => {
    if (!area || !position) throw new Error('World location unavailable.')
    const foundation = { minimap: minimapStore, tutorialNow: () => tutorialRef.current.now(), area, position, guidance: () => guidanceRef.current, camera: camera.current, appearance,
      connection: social.connection,
      exploration: () => explorationRef.current.projection, explorationNow: () => explorationRef.current.now(),
      onDiscover: (landmarkId: string, point: WorldPoint) => { if (fieldRequest.current || explorationRef.current.pending || actions.current.pending) return false; fieldRequest.current = true; void explorationRef.current.execute({ type: 'discover-landmark', landmarkId, position: point }).finally(() => { fieldRequest.current = false }); return true },
      onInteract: (id: string, point?: WorldPoint) => {
        const entity = area.interactables?.find(entity => entity.entityId === id)
        if (entity?.entityId === FIELD_SURVEY.npcEntityId && point) { setInteractionPoint(point); setInteraction(id); return }
        if (entity && !entity.tutorial && point) { void explorationRef.current.execute({ type: entity.kind === 'inspectable' ? 'inspect' : 'harvest', entityId: id, position: point }); return }
        setInteraction(id)
      }, tutorialPot: () => tutorialRef.current.state?.pot ?? null, debug: import.meta.env.MODE === 'staging' && new URLSearchParams(route.search).has('worldDebug'), pending: () => actions.current.pending || !!interactionRef.current || tutorialRef.current.pending, onExit: (id: string) => { void actions.current.transition(id) } }
    if (area.areaType === 'farm') return createFarmWorldGame(parent, bridge, { spawnId: 'default', foundation })
    if (area.areaType === 'town') return createTownWorldGame(parent, bridge, { spawnId: 'farm-arrival', connection: social.connection, foundation })
    return createLdtkWorldGame(parent, foundation)
  }, [area, position, social.connection, route.search, appearance, minimapStore])
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
      <LocalMinimap areaId={area.areaId} hidden={!!interaction || dock.chatDockExpanded || panels.feature !== null || world.pending} />
      {!interaction && !dock.chatDockExpanded && panels.feature === null && <ExplorationNotice />}
      {dock.chatDockExpanded && <InGameChatHud mode={dock.activeTab === 'friends' ? 'world-chat' : dock.activeTab} onModeChange={dock.setActiveTab} />}
      {interaction === FIELD_SURVEY.npcEntityId && interactionPoint ? <FieldSurveyDialog position={interactionPoint} close={() => setInteraction(null)} /> : interaction && area.interactables?.find(e => e.entityId === interaction) && <WorldTutorialDialog key={interaction} entity={area.interactables.find(e => e.entityId === interaction)!} close={() => setInteraction(null)} />}
    </div>
  </section>
}
