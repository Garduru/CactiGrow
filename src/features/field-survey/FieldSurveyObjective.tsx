import { useState } from 'react'
import { FIELD_SURVEY } from '../../../shared/api/fieldSurveyV1.ts'
import { useFieldSurvey } from './FieldSurveyContext'
import { FieldSurveyObjectives } from './FieldSurveyObjectives'
import { fieldSurveyHint } from './fieldSurveyPresentation'
import { useStartingExperience } from '../starting/StartingContext'

export function FieldSurveyObjective() {
  const survey = useFieldSurvey(), [expanded, setExpanded] = useState(true)
  const eligible = useStartingExperience().state?.farmTutorialComplete
  const projection = survey.projection
  if (!survey.active || !eligible || !projection || projection.status === 'locked' || projection.status === 'complete') return null
  return <aside className="starting-objective field-survey-objective" aria-label="Optional Field Survey objective" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
    <button className="starting-objective__toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{FIELD_SURVEY.title}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    {expanded && <div><span className="starting-objective__step">Optional · {projection.status === 'available' ? 'Available' : projection.status === 'ready-to-report' ? 'Ready to report' : 'In progress'}</span>
      {projection.status !== 'available' && <div aria-live="polite"><FieldSurveyObjectives projection={projection} /></div>}
      <p>{fieldSurveyHint(projection)}</p>
      {survey.error && <><p role="alert">{survey.error}</p><button className="cg-button cg-button--ghost" disabled={survey.pending} onClick={() => void survey.refresh()}>Retry survey record</button></>}
    </div>}
  </aside>
}
