import { AppRouter } from './app/AppRouter'
import { GameStateProvider } from './game/GameStateProvider'

function App() {
  return <GameStateProvider><AppRouter /></GameStateProvider>
}

export default App
