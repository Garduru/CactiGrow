import { AppRouter } from './app/AppRouter'
import { PlayerBootstrapProvider } from './app/PlayerBootstrapProvider'
import { GameStateProvider } from './game/GameStateProvider'
import { PlantLifecycleProvider } from './app/PlantLifecycleProvider'
import { DeploymentAccessBoundary } from './app/DeploymentAccessBoundary'
import { GardenAuthorityProvider } from './app/GardenAuthorityProvider'
import { GrowerAuthorityProvider } from './app/GrowerAuthorityProvider'

function App() {
  return (
    <PlayerBootstrapProvider>
      <DeploymentAccessBoundary>
        <PlantLifecycleProvider><GardenAuthorityProvider><GrowerAuthorityProvider><GameStateProvider><AppRouter /></GameStateProvider></GrowerAuthorityProvider></GardenAuthorityProvider></PlantLifecycleProvider>
      </DeploymentAccessBoundary>
    </PlayerBootstrapProvider>
  )
}

export default App
