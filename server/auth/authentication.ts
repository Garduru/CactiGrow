import { getRuntimeMetadata } from '../env.ts'
import { PostgresPlayerIdentityRepository } from '../db/repositories/PostgresPlayerIdentityRepository.ts'
import { DevelopmentIdentityProvider } from '../identity/DevelopmentIdentityProvider.ts'
import { CloudflareAccessIdentityProvider } from '../identity/CloudflareAccessIdentityProvider.ts'
import { CloudflareAccessJwtVerifier } from '../identity/CloudflareAccessJwtVerifier.ts'
import { Base44IdentityProvider, isBase44AppId } from '../identity/Base44IdentityProvider.ts'
import type {
  IdentityProvider,
  IdentityVerificationRequest,
} from '../identity/IdentityProvider.ts'
import type { PlayerIdentityResolver } from '../identity/PlayerIdentityResolver.ts'
import { PostgresPlayerIdentityResolver } from '../identity/PostgresPlayerIdentityResolver.ts'
import { ApiError } from '../api/errors.ts'
import type { ApiRequestContext } from '../api/router.ts'
import type { AuthenticatedPlayerContext } from './AuthenticatedPlayerContext.ts'
import { initializeStagingGrower } from '../staging/initializeGrower.ts'

export interface AuthenticationConfiguration {
  identityProvider: IdentityProvider
  createPlayerIdentityResolver(): Promise<PlayerIdentityResolver>
}

export type AuthenticationConfigurationFactory = (
  context: ApiRequestContext,
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

function createAuthenticationConfiguration(
  context: ApiRequestContext,
): AuthenticationConfiguration | null {
  const { env, database } = context
  const { environment } = getRuntimeMetadata(env)

  let identityProvider: IdentityProvider
  if (environment === 'production') {
    if (!isBase44AppId(env.CACTIGROW_BASE44_APP_ID)) return null
    identityProvider = new Base44IdentityProvider(env.CACTIGROW_BASE44_APP_ID)
  } else if (environment === 'staging') {
    const teamDomain = env.CACTIGROW_ACCESS_TEAM_DOMAIN
    const audience = env.CACTIGROW_ACCESS_AUDIENCE
    if (!teamDomain || !audience) return null
    try {
      identityProvider = new CloudflareAccessIdentityProvider(new CloudflareAccessJwtVerifier(teamDomain, audience))
    } catch {
      return null
    }
  } else {
    identityProvider = new DevelopmentIdentityProvider(environment)
  }

  return {
    identityProvider,
    createPlayerIdentityResolver: async () => {
      const repository = new PostgresPlayerIdentityRepository(await database.getDatabase())
      return new PostgresPlayerIdentityResolver(repository)
    },
  }
}

export async function authenticateRequest(
  context: ApiRequestContext,
  configurationFactory: AuthenticationConfigurationFactory = createAuthenticationConfiguration,
): Promise<AuthenticatedPlayerContext> {
  const configuration = configurationFactory(context)
  if (!configuration) throw ApiError.unauthenticated()

  const externalIdentity = await configuration.identityProvider.verify(
    createVerificationRequest(context.request),
  )
  if (!externalIdentity) throw ApiError.unauthenticated()

  const playerIdentityResolver = await configuration.createPlayerIdentityResolver()
  const playerIdentity = await playerIdentityResolver.resolve(externalIdentity)
  if (!playerIdentity) throw ApiError.unauthenticated()

  // Onboarding follows verified provider identity and internal player resolution.
  // The existing durable marker prevents repeat grants.
  if (['staging', 'production'].includes(getRuntimeMetadata(context.env).environment)) {
    await initializeStagingGrower(await context.database.getDatabase(), playerIdentity.playerId)
  }

  return {
    playerId: playerIdentity.playerId,
    requestId: context.requestId,
    authorizationExpiresAt: externalIdentity.expiresAt,
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
