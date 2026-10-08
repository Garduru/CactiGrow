export interface WorldPoint { x: number; y: number }
export interface WorldSpawn extends WorldPoint { entryId: string }
export interface WorldExit extends WorldPoint { width: number; height: number; exitId: string; targetAreaId: string | null; targetEntryId: string | null; blocked: boolean; futureDestinationLabel: string | null }
export interface WorldInteractable extends WorldPoint { entityId: string; kind: 'npc' | 'harvestable' | 'tutorial-pot'; displayName: string; tutorial: boolean; speciesId?: string; seedYield?: number; respawn?: 'once-per-player' }
export interface WorldVisualLayer { name: 'Ground' | 'GroundVariation' | 'Paths' | 'StructureGrounding' | 'Decorations' | 'BoundaryEdges'; tileset: { uid: number; path: string; tileSize: number; width: number; height: number; inset?: number }; gridWidth: number; gridHeight: number; cellWidth: number; cellHeight: number; offsetX: number; offsetY: number; tiles: { x: number; y: number; sourceX: number; sourceY: number; flip: number; width?: number; height?: number; blendEdges?: number; blendCorners?: number; roundCorners?: number }[] }
export interface WorldArea {
  areaId: string; identifier: string; zoneId: string; displayName: string
  areaType: 'tutorial' | 'path' | 'farm' | 'town' | 'wilderness' | 'cave'
  width: number; height: number; topology: { x: number; y: number; width: number; height: number }
  travelDestinationId: string | null
  travelSpawnId: string | null
  travelDisplayName: string | null
  spawns: WorldSpawn[]; exits: WorldExit[]
  collision: { x: number; y: number; width: number; height: number }[]
  interactables?: WorldInteractable[]; visualLayers?: WorldVisualLayer[]
}
export interface WorldData { worldId: string; version: string; zones: { zoneId: string; displayName: string }[]; areas: WorldArea[] }
export interface WorldLocation {
  projectionVersion: 1; revision: number; areaId: string; runtimeAreaId: string; zoneId: string
  entryId: string; position: WorldPoint; discoveredAreaIds: string[]; discoveredTravelDestinationIds: string[]
}
