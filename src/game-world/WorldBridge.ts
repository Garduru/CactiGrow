import type { WorldIntent, WorldProjection } from './worldTypes'

type ProjectionListener = (projection: WorldProjection) => void
type IntentHandler = (intent: WorldIntent) => void

export class WorldBridge {
  private projection: WorldProjection
  private intentHandler: IntentHandler
  private readonly projectionListeners = new Set<ProjectionListener>()

  constructor(projection: WorldProjection, intentHandler: IntentHandler) {
    this.projection = projection
    this.intentHandler = intentHandler
  }

  getProjection() {
    return this.projection
  }

  updateProjection(projection: WorldProjection) {
    this.projection = projection
    this.projectionListeners.forEach((listener) => listener(projection))
  }

  setIntentHandler(intentHandler: IntentHandler) {
    this.intentHandler = intentHandler
  }

  emitIntent(intent: WorldIntent) {
    this.intentHandler(intent)
  }

  subscribeToProjection(listener: ProjectionListener) {
    this.projectionListeners.add(listener)
    return () => this.projectionListeners.delete(listener)
  }
}
