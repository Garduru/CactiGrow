import type { PlayerBootstrapV1 } from '../../../shared/api/playerBootstrapV1.ts'
import type { PlayerBootstrapV2 } from '../../../shared/api/playerBootstrapV2.ts'
import type { GrowerAlphaProjectionV1 } from '../../../shared/api/growerAlphaV1.ts'

export function getHeaderPlayerValues(
  mode: string,
  local: { cultivationXp: number; tokens: number },
  bootstrap: PlayerBootstrapV1 | PlayerBootstrapV2 | null,
  grower: GrowerAlphaProjectionV1 | null = null,
) {
  if (mode === 'staging') {
    if (grower) return { cultivationXp: grower.player.skills.cultivationXp, tokens: grower.player.tokenBalance }
    if (!bootstrap || bootstrap.projectionVersion !== 2) throw new Error('Staging requires an authoritative Grower projection.')
    return { cultivationXp: bootstrap.grower.skills.cultivationXp, tokens: bootstrap.grower.tokenBalance }
  }
  return local
}
