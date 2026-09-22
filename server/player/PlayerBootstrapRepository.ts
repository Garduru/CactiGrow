export interface PlayerBootstrapRecord {
  playerId: string
  createdAt: Date
}

export interface PlayerBootstrapRepository {
  findByPlayerId(playerId: string): Promise<PlayerBootstrapRecord | null>
  findGrowerByPlayerId?(playerId: string): Promise<{
    profileId: string; initializedAt: Date; starterGrantedAt: Date | null
    tutorialStartedAt: Date | null; tutorialCompletedAt: Date | null
    cultivationXp: number; breedingXp: number; geneticsXp: number; tokenBalance: number; version: number
  } | null>
}
