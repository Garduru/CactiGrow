import { useFeaturePanel } from '../features/menu/featurePanelState'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CANONICAL_FARM_PATH, createFarmTownRoadEntryState, resolveTownSpawnId } from '../app/farmReturnNavigation'
import { WorldNav } from '../components/layout/WorldNav'
import { InGameChatHud } from '../features/social/InGameChatHud'
import { useSocialPanel } from '../features/social/useSocialPanel'
import { createTownWorldGame } from './createTownWorldGame'
import { PhaserWorldHost } from './PhaserWorldHost'
import { townWorldProjection } from './townWorldProjection'
import type { WorldIntent } from './worldTypes'
import { useTownPresence } from './useTownPresence'
import { useSocialState } from '../features/social/useSocialState'

export function TownWorldPage() {
  const navigate = useNavigate()
  const { openFeature } = useFeaturePanel()
  const location = useLocation()
  const spawnId = resolveTownSpawnId(location.state)
  const { connection, status, enabled } = useTownPresence(spawnId)
  const social = useSocialPanel()
  const socialState = useSocialState()
  const openProfile = socialState.openProfile
  const handleIntent = useCallback((intent: WorldIntent) => {
    if (intent.type === 'OPEN_PLAYER_PROFILE') {
      openProfile(intent.publicId)
      return
    }
    const destination = townWorldProjection.locations.find((location) => location.id === intent.locationId)
    if (!destination) return
    if (destination.id === 'farm') navigate(CANONICAL_FARM_PATH, { state: createFarmTownRoadEntryState() })
    else openFeature(destination.id)
  }, [navigate, openProfile, openFeature])
  const createGame = useCallback((parent: HTMLElement, bridge: Parameters<typeof createTownWorldGame>[1], editor?: Parameters<typeof createTownWorldGame>[2]['editor']) => createTownWorldGame(parent, bridge, { spawnId, editor, connection }), [spawnId, connection])

  return (
    <section className="world-page" aria-label="Town">
      <WorldNav
        sceneName="Town"
        destinations={townWorldProjection.locations}
        onTravel={(locationId) => handleIntent({ type: 'ENTER_LOCATION', locationId })}
      />
      <div className="world-page__viewport">
        {enabled && <div className="town-multiplayer-status" role="status">{status}</div>}
        <PhaserWorldHost projection={townWorldProjection} onIntent={handleIntent} createGame={createGame} world="town" />
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
