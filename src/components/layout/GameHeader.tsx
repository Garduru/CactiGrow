import { Link } from 'react-router-dom'
import { getTotalSeedQuantity } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { ProgressBar } from '../ui/ProgressBar'
import { getProgressionSnapshot } from '../../features/progression/progressionModel'

export function GameHeader() {
  const { state } = useGameState()
  const { player } = state
  const progression = getProgressionSnapshot(player.xp)

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
              <strong>{progression.isMaxLevel ? 'Lv. 99 MAX' : `Lv. ${progression.level}`}</strong>
              <span>{player.username}</span>
            </div>

            {progression.isMaxLevel ? (
              <ProgressBar
                value={1}
                max={1}
                label="XP"
                displayValue="MAX"
                ariaLabel="Experience: maximum level"
                ariaValueText={`${progression.totalXp.toLocaleString()} total XP, maximum level`}
              />
            ) : (
              <ProgressBar
                value={progression.progressXp}
                max={progression.requiredXp}
                label="XP"
                ariaLabel={`Level ${progression.level} experience progress`}
                ariaValueText={`${progression.progressXp.toLocaleString()} of ${progression.requiredXp.toLocaleString()} XP toward level ${progression.level + 1}; ${progression.totalXp.toLocaleString()} total XP`}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
