import { handleApiRequest } from './api/handler.ts'
import type { WorkerEnv } from './env.ts'
export { AreaPresence } from './realtime/AreaPresence.ts'

export default {
  fetch(request, env, context) {
    return handleApiRequest(request, env, context)
  },
} satisfies ExportedHandler<WorkerEnv>
