import { useGameState } from '../../game/useGameState'
import { achievementDefinitions } from './achievementsModel'
import { Badge } from '../../components/ui/Badge'
import { LocationHeader } from '../../components/ui/LocationHeader'

export function AchievementsPage() {
  const { state } = useGameState()
  const completedCount = state.achievements.filter(({ completedAt }) => completedAt).length

  return (
    <section aria-labelledby="achievements-title">
      <LocationHeader titleId="achievements-title" eyebrow="Milestones" title="Achievements" subtitle="Recognition earned through work around the Farm." status={<Badge tone="accent">{completedCount} / {achievementDefinitions.length} complete</Badge>} />

      <div className="achievement-list">
        {achievementDefinitions.map((definition) => {
          const progress = state.achievements.find(({ id }) => id === definition.id)
          const completed = Boolean(progress?.completedAt)
          return (
            <article className={`achievement-card achievement-card--${completed ? 'complete' : 'locked'}`} key={definition.id}>
              <Badge tone={completed ? 'success' : 'locked'}>{completed ? 'Completed' : 'Locked'}</Badge>
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
