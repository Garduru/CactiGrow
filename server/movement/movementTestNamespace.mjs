import { MovementOwner } from './MovementOwner.ts'
/** Disposable test binding only. State is serialized just like the private player DO. */
export function movementTestNamespace(now = Date.now) {
  const states = new Map(), queues = new Map()
  return { states, idFromName: name => name, get: name => ({ fetch: request => {
    const task = (queues.get(name) ?? Promise.resolve()).then(async () => {
      const { playerId, command } = await request.json()
      if (name !== `movement-v1:${playerId}`) return new Response(null, { status: 403 })
      const owner = new MovementOwner({ get: () => states.get(name), put: state => states.set(name, structuredClone(state)) }, now)
      try { return Response.json(owner.execute(playerId, command)) } catch { return new Response(null, { status: 409 }) }
    })
    queues.set(name, task.catch(() => {})); return task
  } }) }
}
