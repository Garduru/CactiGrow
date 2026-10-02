import { Outlet } from 'react-router-dom'
import { PlayerBootstrapProvider } from './PlayerBootstrapProvider'
import { DeploymentAccessBoundary } from './DeploymentAccessBoundary'
import { PlantLifecycleProvider } from './PlantLifecycleProvider'
import { GardenAuthorityProvider } from './GardenAuthorityProvider'
import { GrowerAuthorityProvider } from './GrowerAuthorityProvider'
import { GameStateProvider } from '../game/GameStateProvider'
import { SocialPanelProvider } from '../features/social/SocialPanelContext'
import { SocialOverlay } from '../features/social/SocialOverlay'
import { LevelUpNotice } from '../features/progression/LevelUpNotice'
import { GameHeader } from '../components/layout/GameHeader'
import { SocialProvider } from '../features/social/SocialContext'
import { FeaturePanelProvider } from '../features/menu/FeaturePanelProvider'
import { FeaturePanelOverlay } from '../features/menu/FeaturePanelOverlay'
import { useFeaturePanel } from '../features/menu/featurePanelState'

/** One provider tree shared by all game routes; the public website needs no player session. */
export function GameSession() {
  return (
    <PlayerBootstrapProvider>
      <SocialProvider>
        <DeploymentAccessBoundary>
          <PlantLifecycleProvider><GardenAuthorityProvider><GrowerAuthorityProvider><GameStateProvider>
            <FeaturePanelProvider><SocialPanelProvider>
              <GameHeader />
              <GameMain />
              <FeaturePanelOverlay />
              <SocialOverlay />
              <LevelUpNotice />
            </SocialPanelProvider></FeaturePanelProvider>
          </GameStateProvider></GrowerAuthorityProvider></GardenAuthorityProvider></PlantLifecycleProvider>
        </DeploymentAccessBoundary>
      </SocialProvider>
    </PlayerBootstrapProvider>
  )
}

function GameMain() {
  const menu = useFeaturePanel()
  return <main id="main-content" className="game-main" inert={menu.feature !== null}><Outlet /></main>
}
