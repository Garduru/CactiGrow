import { useEffect, useRef, useState } from 'react'
import { TOWN_CONTENT, TOWN_NPC_IDS, type TownNpcId } from '../../../shared/api/townContentV1.ts'
import type { WorldPoint } from '../../../shared/world/types.ts'
import { useModalFocus } from '../../components/ui/useModalFocus'
import { worldInputBoundary } from '../../components/layout/worldInputBoundary'
import { useFeaturePanel, type FeatureId } from '../menu/featurePanelState'
import { useSocialPanel } from '../social/useSocialPanel'
import { useFieldSurvey } from '../field-survey/FieldSurveyContext'
import { useStartingExperience } from '../starting/StartingContext'
import { useTownContent } from './TownContentContext'
import { townPeople, townSurveyNotice } from './townContentPresentation'

export function TownContentDialog({ entityId, position, close }: { entityId: string; position: WorldPoint; close(): void }) {
  const town = useTownContent(), survey = useFieldSurvey(), starting = useStartingExperience(), panels = useFeaturePanel(), dock = useSocialPanel()
  const panel = useRef<HTMLDivElement>(null), talk = useRef(town.talk)
  const alive = useRef(true), scheduled = useRef(false)
  const [firstContact, setFirstContact] = useState<boolean | null>(null)
  const npcId = TOWN_NPC_IDS.find(id => id === entityId), person = npcId ? townPeople[npcId] : null
  const notice = townSurveyNotice(survey.projection, !!starting.state?.farmTutorialComplete)
  useEffect(() => { talk.current = town.talk }, [town.talk])
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!npcId || scheduled.current) return
    scheduled.current = true
    void talk.current(npcId, position).then(result => { if (alive.current && result) setFirstContact(!!result.firstContact) })
  }, [npcId, position])
  useModalFocus(panel, close)
  const open = (feature: FeatureId) => { close(); panels.openFeature(feature) }
  const chat = () => { close(); dock.setActiveTab('town-chat'); dock.setChatDockExpanded(true) }
  async function retryContact(id: TownNpcId) { const result = await town.talk(id, position); if (result) setFirstContact(!!result.firstContact) }
  return <div {...worldInputBoundary} className="tutorial-dialog-backdrop town-content-backdrop" onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
    <div ref={panel} className="tutorial-dialog town-content-dialog" role="dialog" aria-modal="true" aria-labelledby="town-content-title" tabIndex={-1}>
      <header className="tutorial-dialog__header"><span className="eyebrow">{person?.role ?? 'Town community'}</span><h2 id="town-content-title">{person?.name ?? 'Noticeboard'}</h2></header>
      {entityId === 'town-rosa-steward' && <><p>{firstContact === false ? 'Good to see you again. Take a seat in the plaza, or see what the other growers are up to.' : "Welcome to Town. I'm Rosa. The plaza is a place to pause, meet other growers and share what you've learned."}</p><p>Tomas keeps the Shop. The noticeboard points toward field work. Tap another grower to view their profile, or use Friends and chat to stay in touch. Mail delivers even when they're away.</p><div className="town-content-actions"><button className="cg-button" onClick={() => open('shop')}>Open Shop</button><button className="cg-button" onClick={() => open('mail')}>Open Mail</button><button className="cg-button" onClick={() => open('friends')}>Open Friends</button><button className="cg-button" onClick={chat}>Open Town chat</button></div></>}
      {entityId === 'town-tomas-shopkeeper' && <><p>Welcome, grower. The Shop has seeds for your next planting, and you can sell eligible mature specimens there.</p><p>For player listings, visit the Marketplace across the plaza. Its listings are also available through your menu.</p><div className="town-content-actions"><button className="cg-button cg-button--primary" onClick={() => open('shop')}>Open Shop</button></div></>}
      {entityId === 'town-inez-botanist' && <><p>I'm Inez. The sheltered groves and the harsher Basin ground favor different cactus stands. A careful field note can be as useful as a seed.</p>{notice && <p>{notice.status === 'Recorded' ? 'Mara has your Basin survey on record. Those observations are a useful start.' : notice.text}</p>}<p>Your Research Log keeps the traits you've studied. It grows through observations of your own specimens.</p><div className="town-content-actions"><button className="cg-button" onClick={() => open('journal')}>Open Field Journal</button><button className="cg-button" onClick={() => open('research')}>Open Research Log</button></div></>}
      {entityId === TOWN_CONTENT.boardEntityId && <><p>Field work and community notes for growers passing through Town.</p>{notice ? <section className="town-content-notice" aria-labelledby="town-survey-notice"><h3 id="town-survey-notice">First Basin Field Survey</h3><strong>{notice.status}</strong><p>{notice.text}</p><small>Offered and recorded by Mara at Cross Path.</small></section> : <p>Settle into your Farm lessons first. Field observations will be here when you're ready.</p>}<p>The Shop sells seeds. The Marketplace handles player listings. Meet growers in the open plaza and use Town chat to talk.</p><div className="town-content-actions"><button className="cg-button" onClick={() => open('journal')}>Open Field Journal</button></div><p className="town-content-future">More community notices may follow as Town grows.</p></>}
      {npcId && town.error && <p role="alert">{town.error} <button className="cg-button" disabled={town.pending} onClick={() => void retryContact(npcId)}>Retry recording this meeting</button></p>}
      {npcId && town.pending && firstContact === null && <p role="status">Recording your Town notes…</p>}
      <button className="cg-button cg-button--ghost" onClick={close}>Close</button>
    </div>
  </div>
}
