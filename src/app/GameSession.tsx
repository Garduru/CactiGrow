import { Outlet } from 'react-router-dom'
import { StartingProvider } from '../features/starting/StartingProvider'
import { StartingObjective } from '../features/starting/StartingObjective'
import { WorldLocationProvider } from '../game-world/WorldLocationProvider'
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
import { AdminAccessProvider } from '../features/admin/AdminAccessProvider'
import { PlayerAuthorityReconciler } from './PlayerAuthorityReconciler'
import { MailStatusProvider } from '../features/mail/mailStatus'

/** One provider tree shared by all game routes; the public website needs no player session. */
export function GameSession() {
  return (
    <PlayerBootstrapProvider>
      <WorldLocationProvider><SocialProvider><StartingProvider>
        <DeploymentAccessBoundary>
          <PlantLifecycleProvider><GardenAuthorityProvider><GrowerAuthorityProvider><GameStateProvider>
            <PlayerAuthorityReconciler />
            <MailStatusProvider><AdminAccessProvider><FeaturePanelProvider><SocialPanelProvider>
              <GameHeader />
              <GameMain />
              <FeaturePanelOverlay />
              <SocialOverlay />
              <LevelUpNotice />
            </SocialPanelProvider></FeaturePanelProvider></AdminAccessProvider></MailStatusProvider>
          </GameStateProvider></GrowerAuthorityProvider></GardenAuthorityProvider></PlantLifecycleProvider>
        </DeploymentAccessBoundary>
      </StartingProvider></SocialProvider></WorldLocationProvider>
    </PlayerBootstrapProvider>
  )
}

function GameMain() {
  const menu = useFeaturePanel()
  return <main id="main-content" className="game-main" inert={menu.feature !== null && !(menu.feature === 'devtools' && menu.worldPreview)}><StartingObjective /><Outlet /></main>
}
