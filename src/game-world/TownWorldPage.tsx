import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createFarmTownRoadEntryState, createTownReturnState, resolveTownSpawnId } from '../app/farmReturnNavigation'
import { WorldNav } from '../components/layout/WorldNav'
import { InGameChatHud } from '../features/social/InGameChatHud'
import { useSocialPanel } from '../features/social/useSocialPanel'
import { createTownWorldGame } from './createTownWorldGame'
import { PhaserWorldHost } from './PhaserWorldHost'
import { townWorldProjection } from './townWorldProjection'
import type { WorldIntent } from './worldTypes'

export function TownWorldPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const spawnId = resolveTownSpawnId(location.state)
  const social = useSocialPanel()
  const handleIntent = useCallback((intent: WorldIntent) => {
    const destination = townWorldProjection.locations.find((location) => location.id === intent.locationId)
    if (!destination) return
    if (destination.id === 'farm') navigate('/', { state: createFarmTownRoadEntryState() })
    else navigate(destination.route, { state: createTownReturnState(destination.id) })
  }, [navigate])
  const createGame = useCallback((parent: HTMLElement, bridge: Parameters<typeof createTownWorldGame>[1], editor?: Parameters<typeof createTownWorldGame>[2]['editor']) => createTownWorldGame(parent, bridge, { spawnId, editor }), [spawnId])

  return (
    <section className="world-page" aria-label="Town">
      <WorldNav
        sceneName="Town"
        destinations={townWorldProjection.locations}
        onTravel={(locationId) => handleIntent({ type: 'ENTER_LOCATION', locationId })}
      />
      <div className="world-page__viewport">
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
