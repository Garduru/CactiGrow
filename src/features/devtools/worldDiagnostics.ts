import type { WorldEditorController } from '../../game-world/editor/worldEditorState'
import type { GardenDisplayProjection } from '../../game-world/worldTypes'
export interface WorldDiagnosticSnapshot {
  world: string; area: string | null; sessionId: string
  position: { x: number; y: number }; destination: { x: number; y: number } | null
  waypoints: number; multiplayer: { status: string; layer: string | null; remotePlayers: number } | null
}
export interface WorldDiagnosticHandle {
  read(): WorldDiagnosticSnapshot
  resetPosition(): boolean
  enableEditor(): WorldEditorController
  setDebugVisible(visible: boolean): void
}
let active: WorldDiagnosticHandle | null = null
export function registerWorldDiagnostics(handle: WorldDiagnosticHandle) {
  active = handle
  return () => { if (active === handle) active = null }
}
export function getWorldDiagnostics() { return active }
let gardenPreview: GardenDisplayProjection | null = null
const previewListeners = new Set<() => void>()
export const getGardenPreview = () => gardenPreview
export function setGardenPreview(value: GardenDisplayProjection | null) { gardenPreview = value; previewListeners.forEach(listener => listener()) }
export function subscribeGardenPreview(listener: () => void) { previewListeners.add(listener); return () => { previewListeners.delete(listener) } }
