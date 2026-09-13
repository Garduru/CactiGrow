import { Link } from 'react-router-dom'
import { getTotalSeedQuantity } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { ProgressBar } from '../ui/ProgressBar'

export function GameHeader() {
  const { state } = useGameState()
  const player = {
    username: 'Player',
    tokens: 1216,
    level: 4,
    xp: 315,
    xpRequired: 388,
  }

  return (
    <header className="game-header">
      <a className="skip-link" href="#main-content">Skip to game</a>
      <div className="game-header__inner">
        <Link className="game-header__brand" to="/" aria-label="CactiGrow — Farm">
          <img src="/cactigrow-logo.png" alt="CactiGrow by CactiSwap" />
        </Link>

        <div className="game-header__player">
          <div className="game-header__stat">
            <span>Tokens</span>
            <strong>{player.tokens.toLocaleString()}</strong>
          </div>

          <Link className="game-header__inventory" to="/inventory">
            <span>Inventory</span>
            <strong>{getTotalSeedQuantity(state)} Seeds</strong>
          </Link>

          <div className="game-header__level">
            <div className="game-header__level-title">
              <strong>Lv. {player.level}</strong>
              <span>{player.username}</span>
            </div>

            <ProgressBar
              value={player.xp}
              max={player.xpRequired}
              label="XP"
            />
          </div>
        </div>
      </div>
    </header>
  )
}
