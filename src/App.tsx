import { AppRouter } from './app/AppRouter'
import { PlayerBootstrapProvider } from './app/PlayerBootstrapProvider'
import { GameStateProvider } from './game/GameStateProvider'

function App() {
  return (
    <PlayerBootstrapProvider>
      <GameStateProvider><AppRouter /></GameStateProvider>
    </PlayerBootstrapProvider>
  )
}

export default App
