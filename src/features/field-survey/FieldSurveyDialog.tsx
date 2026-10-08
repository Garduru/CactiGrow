import { useRef } from 'react'
import { FIELD_SURVEY } from '../../../shared/api/fieldSurveyV1.ts'
import type { WorldPoint } from '../../../shared/world/types.ts'
import { useModalFocus } from '../../components/ui/useModalFocus'
import { useFieldSurvey } from './FieldSurveyContext'
import { FieldSurveyObjectives } from './FieldSurveyObjectives'
import { fieldSurveyHint } from './fieldSurveyPresentation'
import { useStartingExperience } from '../starting/StartingContext'

export function FieldSurveyDialog({ position, close }: { position: WorldPoint; close(): void }) {
  const survey = useFieldSurvey(), projection = survey.projection, panel = useRef<HTMLDivElement>(null)
  const eligible = useStartingExperience().state?.farmTutorialComplete
  const status = eligible ? projection?.status : 'locked'
  useModalFocus(panel, close, survey.pending)
  return <div className="tutorial-dialog-backdrop" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
    <div ref={panel} className="tutorial-dialog field-survey-dialog" role="dialog" aria-modal="true" aria-labelledby="field-survey-dialog-title" tabIndex={-1}>
      <header className="tutorial-dialog__header"><span className="eyebrow">Mara · Basin field guide</span><h2 id="field-survey-dialog-title">{status === 'locked' ? 'Mara' : FIELD_SURVEY.title}</h2></header>
      {!status && <><p role="status">{survey.error || 'Opening your field record…'}</p><button className="cg-button" disabled={survey.pending} onClick={() => void survey.refresh()}>Retry field record</button></>}
      {status === 'locked' && <p>Get comfortable with your Farm first. When those lessons are complete, stop by if you feel like taking a closer look at the Basin.</p>}
      {status === 'available' && <><p>There's more to this Basin than the road. I could use a grower's eye on the western grove, the dry wash and the eastern rise.</p><p>Gather seed material from wild San Pedro and Peyote. Look inside the cave, study its stone and mineral formation, then tell me what you found. Any observations you've already made will count.</p><p>It's an optional survey. Take your time.</p><small>{FIELD_SURVEY.reward.harvestingXp} Harvesting XP · {FIELD_SURVEY.reward.currency} currency</small><button className="cg-button cg-button--primary" disabled={survey.pending} onClick={() => void survey.converse('accept', position)}>Accept Field Survey</button></>}
      {status === 'active' && projection && <><p>A useful survey starts with looking closely. Your field record keeps track as you go.</p><FieldSurveyObjectives projection={projection} /><p>{fieldSurveyHint(projection)}</p></>}
      {status === 'ready-to-report' && <><p>You covered good ground. Tell me how the cactus stands change across the Basin, and what you saw in the cave.</p><button className="cg-button cg-button--primary" disabled={survey.pending} onClick={() => void survey.converse('report', position)}>Report findings to Mara</button></>}
      {status === 'complete' && projection && <><p role="status">Survey recorded. Those observations will make the next trip a little clearer.</p><p>{projection.rewardClaimed ? `Your survey reward is recorded: ${FIELD_SURVEY.reward.harvestingXp} Harvesting XP and ${FIELD_SURVEY.reward.currency} currency.` : 'Thank you for the field notes.'}</p></>}
      {survey.error && projection && <p role="alert">{survey.error}</p>}
      <button className="cg-button cg-button--ghost" disabled={survey.pending} onClick={close}>{projection?.status === 'available' ? 'Maybe later' : 'Close'}</button>
    </div>
  </div>
}
