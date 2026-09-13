import { useGameState } from '../../game/useGameState'

export function LevelUpNotice() {
  const { state, dismissLevelUp } = useGameState()
  const notice = state.levelUpNotice
  if (!notice) return null

  return (
    <aside className="level-up-notice" role="status" aria-live="polite">
      <div>
        <span>Level up</span>
        <strong>Level {notice.newLevel}</strong>
        {notice.newLevel - notice.oldLevel > 1 && <small>Up from level {notice.oldLevel}</small>}
      </div>
      <button type="button" onClick={() => dismissLevelUp(notice.id)} aria-label="Dismiss level-up message">&times;</button>
    </aside>
  )
}
