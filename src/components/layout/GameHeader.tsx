import { Link } from 'react-router-dom'
import { ProgressBar } from '../ui/ProgressBar'

export function GameHeader() {
  const player = {
    username: 'Player',
    tokens: 1216,
    seeds: 17,
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
            <strong>{player.seeds} Seeds</strong>
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
