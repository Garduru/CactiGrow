import { useEffect, useRef, useState } from 'react'
import { getReactPlantComposition } from '../features/plants/plantPigmentationCompositor'
import type { PlantVisualDescriptor } from '../types/plantVisual'

export type InspectionZoom = 1 | 1.5 | 2

interface VisiblePlant {
  width: number
  height: number
}

export function InspectionPlantPreview({ visual, zoom }: { visual: PlantVisualDescriptor; zoom: InspectionZoom }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [visiblePlant, setVisiblePlant] = useState<VisiblePlant | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const updateSize = () => setViewport({ width: element.clientWidth, height: element.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const canvas = canvasRef.current
    if (!canvas || !visual.baseAsset) {
      setVisiblePlant(null)
      return
    }

    const render = async () => {
      const source = await getReactPlantComposition(visual) ?? visual.baseAsset!.path
      const image = new Image()
      image.decoding = 'async'
      image.src = source
      await image.decode()
      if (!active) return

      const analysis = document.createElement('canvas')
      analysis.width = image.naturalWidth
      analysis.height = image.naturalHeight
      const context = analysis.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, analysis.width, analysis.height).data
      let left = analysis.width
      let top = analysis.height
      let right = -1
      let bottom = -1
      for (let y = 0; y < analysis.height; y += 1) {
        for (let x = 0; x < analysis.width; x += 1) {
          if (pixels[(y * analysis.width + x) * 4 + 3] === 0) continue
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
      if (right < left || bottom < top) return

      const width = right - left + 1
      const height = bottom - top + 1
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(image, left, top, width, height, 0, 0, width, height)
      setVisiblePlant({ width, height })
    }

    setVisiblePlant(null)
    render().catch(() => { if (active) setVisiblePlant(null) })
    return () => { active = false }
  }, [visual])

  const padding = 24
  const availableWidth = Math.max(1, viewport.width - padding * 2)
  const availableHeight = Math.max(1, viewport.height - padding * 2)
  const fitScale = visiblePlant
    ? Math.min(availableWidth / visiblePlant.width, availableHeight / visiblePlant.height)
    : 1
  const renderedWidth = visiblePlant ? visiblePlant.width * fitScale * zoom : 0
  const renderedHeight = visiblePlant ? visiblePlant.height * fitScale * zoom : 0

  useEffect(() => {
    const element = viewportRef.current
    if (!element || zoom === 1) return
    element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2)
    element.scrollTop = Math.max(0, (element.scrollHeight - element.clientHeight) / 2)
  }, [zoom, renderedWidth, renderedHeight])

  return <div className="plant-test__inspection-viewport" ref={viewportRef} tabIndex={0} aria-label="Scrollable plant art inspection viewport">
    <div className="plant-test__inspection-surface" style={{ width: Math.max(viewport.width, renderedWidth + padding * 2), height: Math.max(viewport.height, renderedHeight + padding * 2) }}>
      {visual.baseAsset
        ? <canvas
            ref={canvasRef}
            className="plant-test__inspection-canvas"
            role="img"
            aria-label={`Enlarged ${visual.visualStage} ${visual.speciesVisualKey} art inspection`}
            style={{ width: renderedWidth || undefined, height: renderedHeight || undefined }}
          />
        : <span>No registered species/stage artwork to inspect.</span>}
    </div>
  </div>
}
