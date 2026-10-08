import { useFieldSurvey } from './FieldSurveyContext'
import { FieldSurveyObjectives } from './FieldSurveyObjectives'

export function FieldSurveyDevInspection({ enabled, recordAction }: { enabled: boolean; recordAction(label: string): void }) {
  const survey = useFieldSurvey(), projection = survey.projection
  if (!survey.active) return null
  return <details className="dev-tools__card"><summary>First Basin Field Survey</summary>
    <p>Reset only your survey acceptance and completion. Landmarks, wild harvest history, earned XP and currency remain intact. The reward can only be granted once, including after a reset.</p>
    <button disabled={survey.pending} onClick={() => void survey.refresh()}>Inspect Field Survey state</button>
    {projection && <><dl className="dev-tools__facts"><div><dt>Status</dt><dd>{projection.status}</dd></div><div><dt>Revision</dt><dd>{projection.revision}</dd></div><div><dt>Lifetime reward</dt><dd>{projection.rewardClaimed ? 'Already granted' : 'Not yet granted'}</dd></div></dl><FieldSurveyObjectives projection={projection} />
      <button disabled={!enabled || survey.pending} onClick={() => void survey.reset().then(done => { if (done) recordAction('Reset own First Basin Field Survey only') })}>Reset own Field Survey quest only</button></>}
    {survey.error && <p role="alert">{survey.error}</p>}
  </details>
}
