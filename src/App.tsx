import { AppRouter } from './app/AppRouter'
import { PlayerBootstrapProvider } from './app/PlayerBootstrapProvider'
import { GameStateProvider } from './game/GameStateProvider'
import { PlantLifecycleProvider } from './app/PlantLifecycleProvider'

function App() {
  return (
    <PlayerBootstrapProvider>
      <PlantLifecycleProvider><GameStateProvider><AppRouter /></GameStateProvider></PlantLifecycleProvider>
    </PlayerBootstrapProvider>
  )
}

export default App
