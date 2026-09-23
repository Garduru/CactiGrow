import type { GrowerAlphaCommandInputV1, GrowerAlphaCommandV1, GrowerAlphaProjectionV1 } from '../../shared/api/growerAlphaV1.ts'

interface Dependencies {
  send: (command: GrowerAlphaCommandV1) => Promise<GrowerAlphaProjectionV1>
  read: () => Promise<GrowerAlphaProjectionV1>
  apply: (projection: GrowerAlphaProjectionV1) => void
  invalidateReads: () => void
  reconcileFailure: () => Promise<void>
  saleSettled: () => void
  createId: () => string
}

/** Serialize this client's mutations and retain receipt identity after uncertain sales. */
export function createGrowerCommandRunner(deps: Dependencies) {
  let tail: Promise<unknown> = Promise.resolve()
  const pendingSales = new Map<string, string>()
  return (input: GrowerAlphaCommandInputV1): Promise<GrowerAlphaProjectionV1> => {
    const task = tail.then(async () => {
      const specimenId = input.type === 'sell-specimen-to-npc' ? input.specimenId : null
      const previousId = specimenId ? pendingSales.get(specimenId) : undefined
      const commandId = previousId ?? deps.createId()
      if (specimenId) pendingSales.set(specimenId, commandId)
      deps.invalidateReads()
      try {
        const receipt = await deps.send({ ...input, commandId } as GrowerAlphaCommandV1)
        // A replay contains the original, possibly old balance. Read current state.
        const projection = previousId ? await deps.read() : receipt
        deps.invalidateReads()
        deps.apply(projection)
        if (specimenId) pendingSales.delete(specimenId)
        return projection
      } catch (error) {
        await deps.reconcileFailure()
        throw error
      } finally {
        // A failed response may still represent a committed sale.
        if (specimenId) deps.saleSettled()
      }
    })
    tail = task.catch(() => undefined)
    return task
  }
}
