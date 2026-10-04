export interface PlayerAuthorityRevisionV1 {
  projectionVersion: 1
  profileVersion: number
  growerVersion: number
  lifecycleVersion: number
}

export function isPlayerAuthorityRevisionV1(value: unknown): value is PlayerAuthorityRevisionV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.projectionVersion === 1 && ['profileVersion', 'growerVersion', 'lifecycleVersion'].every(key => Number.isSafeInteger(v[key]) && (v[key] as number) >= 0)
}
