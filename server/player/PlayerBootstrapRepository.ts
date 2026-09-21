export interface PlayerBootstrapRecord {
  playerId: string
  createdAt: Date
}

export interface PlayerBootstrapRepository {
  findByPlayerId(playerId: string): Promise<PlayerBootstrapRecord | null>
}
