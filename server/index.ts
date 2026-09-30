import { handleApiRequest } from './api/handler.ts'
import type { WorkerEnv } from './env.ts'
export { AreaPresence } from './realtime/AreaPresence.ts'

export default {
  fetch(request, env, context) {
    const url = new URL(request.url)
    if (env.CACTIGROW_ENVIRONMENT === 'production' && url.hostname === 'www.cactigrow.com') {
      url.hostname = 'cactigrow.com'
      url.protocol = 'https:'
      url.port = ''
      return Response.redirect(url.toString(), 308)
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    return handleApiRequest(request, env, context)
  },
} satisfies ExportedHandler<WorkerEnv>
