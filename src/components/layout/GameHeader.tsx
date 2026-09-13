import { ProgressBar } from '../ui/ProgressBar'

export function GameHeader() {
  // Temporary local data.
  // Later this comes from the CactiSwap integration layer.
  const player = {
    username: 'Player',
    tokens: 1216,
    level: 4,
    xp: 315,
    xpRequired: 388,
  }

  return (
    <header className="game-header">
      <div className="game-header__inner">
        <div className="game-header__brand">
          <span className="game-header__cactus">🌵</span>

          <div>
            <strong>CactiGrow</strong>
            <span>Grow • Breed • Collect</span>
          </div>
        </div>

        <div className="game-header__player">
          <div className="game-header__tokens">
            <span>Tokens</span>
            <strong>🪙 {player.tokens.toLocaleString()}</strong>
          </div>

          <div className="game-header__level">
            <div className="game-header__level-title">
              <strong>Lv. {player.level}</strong>
              <span>{player.username}</span>
            </div>

            <ProgressBar
              value={player.xp}
              max={player.xpRequired}
            />
          </div>

          <button className="cactiswap-button" type="button">
            CactiSwap
          </button>
        </div>
      </div>
    </header>
  )
}