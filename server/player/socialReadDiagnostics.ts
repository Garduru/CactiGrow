const relations = new Set(['players', 'player_external_identities', 'player_onboarding', 'player_profiles', 'friend_requests', 'friendships', 'player_blocks', 'plant_specimens', 'bred_seeds'])
const columns = new Set(['id', 'player_id', 'public_id', 'display_name', 'created_at', 'updated_at', 'cultivation_xp', 'breeding_xp', 'genetics_xp', 'owner_player_id', 'lifecycle_status', 'from_player_id', 'to_player_id', 'status', 'player_low_id', 'player_high_id', 'blocker_player_id', 'blocked_player_id'])

export type SocialReadOperation = 'social.profiles' | 'social.collections' | 'social.bredSeeds' | 'social.friendships' | 'social.incoming' | 'social.outgoing' | 'social.blocks' | 'social.projection'

export class SocialReadError extends Error {
  readonly operation: SocialReadOperation
  constructor(operation: SocialReadOperation, cause: unknown) {
    super('Social read failed.', { cause })
    this.name = 'SocialReadError'
    this.operation = operation
  }
}

export async function socialRead<T>(operation: SocialReadOperation, read: () => PromiseLike<T>): Promise<T> {
  try { return await read() } catch (cause) { throw new SocialReadError(operation, cause) }
}

/** Allowlisted server metadata only: never query text, parameters, detail or stack. */
export function safeSocialReadDiagnostic(error: unknown) {
  let current = error
  let operation: SocialReadOperation | undefined
  let sqlState: string | undefined
  let relation: string | undefined
  let column: string | undefined
  let shapeError = false
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    if (current instanceof SocialReadError) operation ??= current.operation
    if (current instanceof TypeError || current instanceof RangeError) shapeError = true
    const fields = current as { code?: unknown; table?: unknown; column?: unknown; message?: unknown; cause?: unknown }
    if (typeof fields.code === 'string' && /^[0-9A-Z]{5}$/.test(fields.code)) sqlState ??= fields.code
    if (typeof fields.table === 'string' && relations.has(fields.table)) relation ??= fields.table
    if (typeof fields.column === 'string' && columns.has(fields.column)) column ??= fields.column
    if (typeof fields.message === 'string') {
      const match = /^(?:relation "([a-z_]+)" does not exist|permission denied for table ([a-z_]+))$/.exec(fields.message)
      const name = match?.[1] ?? match?.[2]
      if (name && relations.has(name)) relation ??= name
    }
    current = fields.cause
  }
  return { operation, sqlState, relation, column, classification: sqlState === '42501' ? 'permission-denied' : sqlState === '42P01' ? 'missing-relation' : sqlState === '42703' ? 'missing-column' : sqlState ? 'database-error' : shapeError ? 'data-shape' : 'unknown-error' }
}
