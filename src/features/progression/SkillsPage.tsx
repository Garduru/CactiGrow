import { ProgressBar } from '../../components/ui/ProgressBar'
import { GameCard } from '../../components/ui/GameCard'
import { useGameState } from '../../game/useGameState'
import { getProgressionSnapshot } from './progressionModel'
import { harvestingSkillDefinition, skillDefinitions } from './skillDefinitions'
import { useStartingExperience } from '../starting/StartingContext'

export function SkillsPage() {
  const { state } = useGameState()
  const tutorial = useStartingExperience()
  const visibleSkills = tutorial.active && tutorial.state ? [...skillDefinitions, harvestingSkillDefinition] : skillDefinitions

  return (
    <section aria-labelledby="skills-title">
      <h1 id="skills-title">Skills</h1>
      <p>Each skill advances independently through its own experience.</p>

      <div className="skills-grid">
        {visibleSkills.map((skill) => {
          const progression = getProgressionSnapshot(skill.id === 'harvesting' ? tutorial.state?.harvestingXp ?? 0 : state.player.skills[skill.id].xp)
          return (
            <GameCard className="skill-card" key={skill.id}>
              <header>
                <h2>{skill.name}</h2>
                <strong>{progression.isMaxLevel ? 'Level 99 · MAX' : `Level ${progression.level}`}</strong>
              </header>
              <p>{skill.description}</p>
              <dl>
                <div><dt>Total XP</dt><dd>{progression.totalXp.toLocaleString()}</dd></div>
                <div><dt>Next level</dt><dd>{progression.isMaxLevel ? 'MAX' : `${progression.remainingXp.toLocaleString()} XP remaining`}</dd></div>
              </dl>
              {progression.isMaxLevel ? (
                <ProgressBar
                  value={1}
                  max={1}
                  label={`${skill.name} XP`}
                  displayValue="MAX"
                  ariaLabel={`${skill.name} experience: maximum level`}
                  ariaValueText={`${progression.totalXp.toLocaleString()} total XP, maximum level`}
                />
              ) : (
                <ProgressBar
                  value={progression.progressXp}
                  max={progression.requiredXp}
                  label={`${skill.name} XP`}
                  ariaLabel={`${skill.name} level ${progression.level} experience progress`}
                  ariaValueText={`${progression.progressXp.toLocaleString()} of ${progression.requiredXp.toLocaleString()} XP toward level ${progression.level + 1}`}
                />
              )}
            </GameCard>
          )
        })}
      </div>
    </section>
  )
}
