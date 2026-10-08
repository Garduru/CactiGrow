import type { FieldSurveyProjectionV1 } from '../../../shared/api/fieldSurveyV1.ts'
import { fieldSurveyObjectives } from './fieldSurveyPresentation'

export function FieldSurveyObjectives({ projection }: { projection: FieldSurveyProjectionV1 }) {
  return <ul className="field-survey-objectives">{fieldSurveyObjectives(projection).map(objective => <li key={objective.id}>
    <span className={objective.complete ? 'field-survey-objectives__complete' : ''} aria-label={objective.complete ? 'Complete' : 'Pending'}>{objective.complete ? '✓' : '○'}</span>
    <span>{objective.label}</span>{objective.detail && <strong>{objective.detail}</strong>}
  </li>)}</ul>
}
