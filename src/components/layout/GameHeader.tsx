import { Link } from 'react-router-dom'
import { getTotalSeedQuantity } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { ProgressBar } from '../ui/ProgressBar'
import { getProgressionSnapshot } from '../../features/progression/progressionModel'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { getDeploymentMode } from '../../config/deploymentMode'
import { getHeaderPlayerValues } from './headerPlayerModel'

export function GameHeader() {
  const { state } = useGameState()
  const { player } = state
  const bootstrap = usePlayerBootstrap()
  const values = getHeaderPlayerValues(getDeploymentMode(), { cultivationXp: player.skills.cultivation.xp, tokens: player.tokens }, bootstrap.status === 'authenticated' ? bootstrap.bootstrap : null)
  const progression = getProgressionSnapshot(values.cultivationXp)
  const lifecycle = usePlantLifecycle()
  const seedCount = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready'
    ? lifecycle.state.projection.seedStacks.reduce((total, stack) => total + stack.quantity, 0) + lifecycle.state.projection.bredSeeds.length
    : getTotalSeedQuantity(state)

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
            <strong>{values.tokens.toLocaleString()}</strong>
          </div>

          <Link className="game-header__inventory" to="/inventory">
            <span>Inventory</span>
            <strong>{seedCount} Seeds</strong>
          </Link>

          <div className="game-header__level">
            <div className="game-header__level-title">
              <strong><span className="game-header__skill-name">Cultivation </span>{progression.isMaxLevel ? 'Lv. 99 MAX' : `Lv. ${progression.level}`}</strong>
              <span>{player.username}</span>
            </div>

            {progression.isMaxLevel ? (
              <ProgressBar
                value={1}
                max={1}
                label="XP"
                displayValue="MAX"
                ariaLabel="Cultivation experience: maximum level"
                ariaValueText={`${progression.totalXp.toLocaleString()} total XP, maximum level`}
              />
            ) : (
              <ProgressBar
                value={progression.progressXp}
                max={progression.requiredXp}
                label="XP"
                ariaLabel={`Cultivation level ${progression.level} experience progress`}
                ariaValueText={`${progression.progressXp.toLocaleString()} of ${progression.requiredXp.toLocaleString()} Cultivation XP toward level ${progression.level + 1}; ${progression.totalXp.toLocaleString()} total XP`}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
