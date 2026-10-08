import { createContext, useContext } from 'react'
import type { FieldSurveyProjectionV1 } from '../../../shared/api/fieldSurveyV1.ts'
import type { WorldPoint } from '../../../shared/world/types.ts'

export interface FieldSurveyValue {
  active: boolean
  projection: FieldSurveyProjectionV1 | null
  pending: boolean
  error: string
  applyProjection(projection: FieldSurveyProjectionV1): void
  refresh(): Promise<void>
  converse(type: 'accept' | 'report', position: WorldPoint): Promise<boolean>
  reset(): Promise<boolean>
}

export const FieldSurveyContext = createContext<FieldSurveyValue>({
  active: false, projection: null, pending: false, error: '', applyProjection() {},
  refresh: async () => {}, converse: async () => false, reset: async () => false,
})
export const useFieldSurvey = () => useContext(FieldSurveyContext)
