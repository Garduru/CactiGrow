import type { WorldDiagnosticSnapshot } from './worldDiagnostics'
import type { PlayerSkills } from '../../types/skill'
import { publicSkillsFromPlayer, getTotalLevel } from '../progression/publicSkills'
/** Explicit allowlist: never spread auth, bootstrap, request or provider data. */
export function createDebugSnapshot(input: { environment: string; version: string | null; playerId: string | null; name: string | null; route: string; world: WorldDiagnosticSnapshot | null; skills: PlayerSkills; currency: number; gardenLevel: number; bootstrap: string; authority: string }) {
  const skills = publicSkillsFromPlayer(input.skills)
  const position = input.world ? { x: input.world.position.x, y: input.world.position.y } : null
  const multiplayer = input.world?.multiplayer ? { status: input.world.multiplayer.status, layer: input.world.multiplayer.layer, remotePlayers: input.world.multiplayer.remotePlayers } : null
  return { timestamp: new Date().toISOString(), environment: input.environment, workerVersion: input.version, playerId: input.playerId, publicName: input.name, route: input.route.split(/[?#]/)[0], panel: 'devtools', bootstrap: input.bootstrap, authority: input.authority, world: input.world?.world ?? null, area: input.world?.area ?? null, worldSessionId: input.world?.sessionId ?? null, position, multiplayer, skills, totalLevel: getTotalLevel(skills), currency: input.currency, gardenLevel: input.gardenLevel }
}
