import { useGameState } from '../../game/useGameState'
import { getSkillDefinition } from './skillDefinitions'

export function LevelUpNotice() {
  const { state, dismissLevelUp } = useGameState()
  const notice = state.levelUpNotice
  if (!notice) return null
  const skill = getSkillDefinition(notice.skillId)

  return (
    <aside className="level-up-notice" role="status" aria-live="polite">
      <div>
        <span>{skill.name} level up!</span>
        <strong>You reached Level {notice.newLevel}</strong>
        {notice.newLevel - notice.oldLevel > 1 && <small>Up from level {notice.oldLevel}</small>}
      </div>
      <button type="button" onClick={() => dismissLevelUp(notice.id)} aria-label="Dismiss level-up message">&times;</button>
    </aside>
  )
}
