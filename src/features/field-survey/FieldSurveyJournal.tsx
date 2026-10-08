import { FIELD_SURVEY } from '../../../shared/api/fieldSurveyV1.ts'
import { useFieldSurvey } from './FieldSurveyContext'
import { FieldSurveyObjectives } from './FieldSurveyObjectives'
import { fieldSurveyHint } from './fieldSurveyPresentation'
import { useStartingExperience } from '../starting/StartingContext'

export function FieldSurveyJournal() {
  const survey = useFieldSurvey(), projection = survey.projection
  const eligible = useStartingExperience().state?.farmTutorialComplete
  if (!survey.active || !eligible || !projection || projection.status === 'locked') return null
  return <section className="field-survey-journal" aria-labelledby="field-survey-journal-title">
    <span className="eyebrow">Optional survey · {projection.status === 'complete' ? 'Complete' : projection.status === 'available' ? 'Available' : projection.status === 'ready-to-report' ? 'Ready to report' : 'In progress'}</span>
    <h2 id="field-survey-journal-title">{FIELD_SURVEY.title}</h2>
    <p>Survey the Basin's western grove, dry wash and eastern rise. Collect wild cactus seed material, then record the cave's stone and mineral formation. Bring your observations back to Mara at Cross Path.</p>
    <FieldSurveyObjectives projection={projection} />
    <p>{fieldSurveyHint(projection)}</p>
    <small>Reward: {FIELD_SURVEY.reward.harvestingXp} Harvesting XP · {FIELD_SURVEY.reward.currency} currency. Prior discoveries and wild harvests count.</small>
    {projection.completedAt && <p>Reported <time dateTime={projection.completedAt}>{new Date(projection.completedAt).toLocaleDateString()}</time>.</p>}
    <p className="field-survey-journal__notes">Your discovered landmark descriptions and cave observations appear in the First Basin field record below.</p>
  </section>
}
