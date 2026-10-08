import assert from 'node:assert/strict'
import test from 'node:test'
import { townSurveyNotice } from './townContentPresentation.ts'
import type { FieldSurveyProjectionV1 } from '../../../shared/api/fieldSurveyV1.ts'

test('Town points every live survey phase to the existing Mara flow and hides it before Farm completion', () => {
  for (const status of ['locked', 'available', 'active', 'ready-to-report', 'complete'] as const) {
    const projection = { status } as FieldSurveyProjectionV1
    assert.equal(townSurveyNotice(projection, false), null)
    const notice = townSurveyNotice(projection, true)
    if (status === 'locked') assert.equal(notice, null)
    else { assert.ok(notice?.text.includes('Mara')); assert.ok(status === 'complete' || notice.text.includes('Cross Path')) }
  }
  assert.equal(townSurveyNotice(null, false), null)
  assert.equal(townSurveyNotice({ status: 'ready-to-report' } as FieldSurveyProjectionV1, true)?.status, 'Ready to report')
})
