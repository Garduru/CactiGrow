import { getRuntimeMetadata, type WorkerEnv } from '../env.ts'
import { connectRequestDatabase } from '../db/client/database.ts'
import { PostgresPlayerIdentityRepository } from '../db/repositories/PostgresPlayerIdentityRepository.ts'
import { DevelopmentIdentityProvider } from '../identity/DevelopmentIdentityProvider.ts'
import type {
  IdentityProvider,
  IdentityVerificationRequest,
} from '../identity/IdentityProvider.ts'
import type { PlayerIdentityResolver } from '../identity/PlayerIdentityResolver.ts'
import { PostgresPlayerIdentityResolver } from '../identity/PostgresPlayerIdentityResolver.ts'
import { ApiError } from '../api/errors.ts'
import type { ApiRequestContext } from '../api/router.ts'
import type { AuthenticatedPlayerContext } from './AuthenticatedPlayerContext.ts'

export interface AuthenticationConfiguration {
  identityProvider: IdentityProvider
  createPlayerIdentityResolver(): Promise<PlayerIdentityResolver>
}

export type AuthenticationConfigurationFactory = (
  env: WorkerEnv,
) => AuthenticationConfiguration | null

export interface AuthenticatedApiRequestContext extends ApiRequestContext {
  player: AuthenticatedPlayerContext
}

export type AuthenticatedApiHandler = (
  context: AuthenticatedApiRequestContext,
) => Response | Promise<Response>

function createVerificationRequest(request: Request): IdentityVerificationRequest {
  return {
    authorizationHeader: request.headers.get('authorization') ?? undefined,
    cookieHeader: request.headers.get('cookie') ?? undefined,
    getHeader: (name) => request.headers.get(name),
  }
}

function createAuthenticationConfiguration(env: WorkerEnv): AuthenticationConfiguration | null {
  const { environment } = getRuntimeMetadata(env)

  if (environment === 'production') return null

  return {
    identityProvider: new DevelopmentIdentityProvider(environment),
    createPlayerIdentityResolver: async () => {
      const database = await connectRequestDatabase(env)
      const repository = new PostgresPlayerIdentityRepository(database)
      return new PostgresPlayerIdentityResolver(repository)
    },
  }
}

export async function authenticateRequest(
  context: ApiRequestContext,
  configurationFactory: AuthenticationConfigurationFactory = createAuthenticationConfiguration,
): Promise<AuthenticatedPlayerContext> {
  const configuration = configurationFactory(context.env)
  if (!configuration) throw ApiError.unauthenticated()

  const externalIdentity = await configuration.identityProvider.verify(
    createVerificationRequest(context.request),
  )
  if (!externalIdentity) throw ApiError.unauthenticated()

  const playerIdentityResolver = await configuration.createPlayerIdentityResolver()
  const playerIdentity = await playerIdentityResolver.resolve(externalIdentity)
  if (!playerIdentity) throw ApiError.unauthenticated()

  return {
    playerId: playerIdentity.playerId,
    requestId: context.requestId,
    externalIdentity: {
      provider: externalIdentity.provider,
      subject: externalIdentity.subject,
    },
  }
}

export async function withAuthenticatedPlayer(
  context: ApiRequestContext,
  handler: AuthenticatedApiHandler,
  configurationFactory?: AuthenticationConfigurationFactory,
): Promise<Response> {
  const player = await authenticateRequest(context, configurationFactory)
  return handler({ ...context, player })
}
