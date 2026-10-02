import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { useGameState } from '../../game/useGameState'
import { useSocialState } from '../social/useSocialState'
import { publicSkillsFromPlayer, publicSkillsFromXp } from './publicSkills'

export function useOwnPublicSkills() {
  const grower = useGrowerAuthority()
  const { state } = useGameState()
  const social = useSocialState()
  if (grower.state.authority === 'server') {
    if (grower.state.status === 'ready') return publicSkillsFromXp(grower.state.projection.player.skills)
    return social.state.status === 'ready' ? social.state.overview.ownProfile?.skills ?? null : null
  }
  return publicSkillsFromPlayer(state.player.skills)
}
