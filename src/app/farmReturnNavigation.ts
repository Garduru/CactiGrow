export const PHASER_PREVIEW_RETURN_PATH = '/world-preview' as const

export interface FarmReturnNavigationState {
  farmReturnTo: typeof PHASER_PREVIEW_RETURN_PATH
}

export function createPhaserPreviewReturnState(): FarmReturnNavigationState {
  return { farmReturnTo: PHASER_PREVIEW_RETURN_PATH }
}

export function resolveFarmReturnPath(state: unknown): '/' | typeof PHASER_PREVIEW_RETURN_PATH {
  if (
    typeof state === 'object'
    && state !== null
    && 'farmReturnTo' in state
    && state.farmReturnTo === PHASER_PREVIEW_RETURN_PATH
  ) return PHASER_PREVIEW_RETURN_PATH

  return '/'
}
