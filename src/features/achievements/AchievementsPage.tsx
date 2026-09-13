import { useGameState } from '../../game/useGameState'
import { achievementDefinitions } from './achievementsModel'

export function AchievementsPage() {
  const { state } = useGameState()
  const completedCount = state.achievements.filter(({ completedAt }) => completedAt).length

  return (
    <section aria-labelledby="achievements-title">
      <div className="achievements-header">
        <div>
          <h1 id="achievements-title">Achievements</h1>
          <p>Milestones from your work around the Farm.</p>
        </div>
        <strong>{completedCount} / {achievementDefinitions.length} complete</strong>
      </div>

      <div className="achievement-list">
        {achievementDefinitions.map((definition) => {
          const progress = state.achievements.find(({ id }) => id === definition.id)
          const completed = Boolean(progress?.completedAt)
          return (
            <article className={`achievement-card achievement-card--${completed ? 'complete' : 'locked'}`} key={definition.id}>
              <span aria-label={completed ? 'Completed' : 'Locked'}>{completed ? 'Completed' : 'Locked'}</span>
              <h2>{definition.name}</h2>
              <p>{definition.description}</p>
              {progress?.completedAt && <time dateTime={progress.completedAt}>Earned {new Date(progress.completedAt).toLocaleString()}</time>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
