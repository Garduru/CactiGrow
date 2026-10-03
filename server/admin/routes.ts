import type { ApiRequestContext } from '../api/router.ts'
import type { AuthenticationConfigurationFactory } from '../auth/authentication.ts'
import { withAuthenticatedPlayer } from '../auth/authentication.ts'
import { getRuntimeMetadata } from '../env.ts'
import { successResponse } from '../api/response.ts'
import { ApiError } from '../api/errors.ts'
import { AdminService } from './AdminService.ts'
import { requirePermission } from './permissions.ts'
import type { AdminAction } from '../../shared/api/adminV1.ts'

export async function routeAdmin(context: ApiRequestContext, readJson: (request: Request) => Promise<unknown>, authentication?: AuthenticationConfigurationFactory) {
  const environment = getRuntimeMetadata(context.env).environment
  if (environment === 'development') {
    let isolated = false
    try { const target = new URL(context.env.HYPERDRIVE?.connectionString ?? ''); isolated = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && target.pathname === '/cactigrow_local' } catch { /* Fail closed. */ }
    if (!isolated) throw ApiError.notFound('Admin routes require an isolated local database.')
  }
  return withAuthenticatedPlayer(context, async ({ player }) => {
    const database = await context.database.getDatabase(), actor = player.playerId
    await requirePermission(database, actor, 'admin.access')
    const service = new AdminService(database), url = new URL(context.request.url), path = url.pathname.slice('/api/v1/admin'.length), method = context.request.method
    const read = () => { if (method !== 'GET') throw ApiError.methodNotAllowed() }
    const respond = (data: unknown) => successResponse(data, context.requestId)
    const offset = () => Number(url.searchParams.get('offset') ?? 0)
    if (path === '/me') { read(); return respond(await service.session(actor, getRuntimeMetadata(context.env))) }
    if (path === '/players/search') { read(); return respond(await service.search(actor, url.searchParams.get('q') ?? '')) }
    if (path === '/roles') { read(); return respond(await service.roles(actor, offset())) }
    if (path === '/marketplace') { read(); return respond(await service.listings(actor, offset(), url.searchParams.get('filter') ?? '')) }
    if (path === '/audit') { read(); return respond(await service.audit(actor, offset(), { actor: url.searchParams.get('actor') ?? undefined, target: url.searchParams.get('target') ?? undefined, action: url.searchParams.get('action') ?? undefined })) }
    const specimen = /^\/specimens\/([^/]+)$/.exec(path)
    if (specimen) { read(); return respond(await service.specimen(actor, specimen[1])) }
    const inspection = /^\/players\/([^/]+)$/.exec(path)
    if (inspection) { read(); return respond(await service.inspect(actor, inspection[1])) }
    const correction = /^\/players\/([^/]+)\/(currency|progression|inventory|role)$/.exec(path)
    const cancel = /^\/marketplace\/([^/]+)\/cancel$/.exec(path)
    if (correction || cancel) {
      if (method !== 'POST') throw ApiError.methodNotAllowed()
      const action: AdminAction = correction ? correction[2] as AdminAction : 'cancel-listing'
      // Deny before reading attacker-controlled bodies; service checks again under role lock.
      await requirePermission(database, actor, ({ currency: 'economy.adjust', progression: 'progression.adjust', inventory: 'inventory.adjust', role: 'roles.manage', 'cancel-listing': 'marketplace.moderate' } as const)[action])
      return respond(await service.mutate(actor, correction?.[1] ?? cancel![1], action, await readJson(context.request)))
    }
    throw ApiError.notFound('Admin route not found.')
  }, authentication)
}
