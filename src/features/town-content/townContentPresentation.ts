import type { FieldSurveyProjectionV1 } from '../../../shared/api/fieldSurveyV1.ts'
import type { TownNpcId } from '../../../shared/api/townContentV1.ts'

export const townPeople: Record<TownNpcId, { name: string; role: string }> = {
  'town-rosa-steward': { name: 'Rosa', role: 'Town steward' },
  'town-tomas-shopkeeper': { name: 'Tomas', role: 'Shopkeeper' },
  'town-inez-botanist': { name: 'Inez', role: 'Field botanist' },
}
export function townSurveyNotice(projection: FieldSurveyProjectionV1 | null, eligible: boolean) {
  if (!eligible || projection?.status === 'locked') return null
  switch (projection?.status) {
    case 'complete': return { status: 'Recorded', text: 'Your survey is recorded with Mara. Keep exploring at your own pace.' }
    case 'ready-to-report': return { status: 'Ready to report', text: 'Return to Mara at Cross Path to report your findings.' }
    case 'active': return { status: 'In progress', text: 'Your Field Journal tracks the survey. Report to Mara at Cross Path when your observations are complete.' }
    default: return { status: 'Optional survey', text: 'Speak with Mara at Cross Path to hear about the First Basin Field Survey.' }
  }
}
