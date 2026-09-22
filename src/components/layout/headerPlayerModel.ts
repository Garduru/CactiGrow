import type { PlayerBootstrapV1 } from '../../../shared/api/playerBootstrapV1.ts'
import type { PlayerBootstrapV2 } from '../../../shared/api/playerBootstrapV2.ts'

export function getHeaderPlayerValues(
  mode: string,
  local: { cultivationXp: number; tokens: number },
  bootstrap: PlayerBootstrapV1 | PlayerBootstrapV2 | null,
) {
  if (mode === 'staging') {
    if (!bootstrap || bootstrap.projectionVersion !== 2) throw new Error('Staging requires an authoritative Grower projection.')
    return { cultivationXp: bootstrap.grower.skills.cultivationXp, tokens: bootstrap.grower.tokenBalance }
  }
  return local
}
