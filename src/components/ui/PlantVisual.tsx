import { useEffect, useState } from 'react'
import type { PlantVisualDescriptor } from '../../types/plantVisual'
import { getPlantCompositionKey, getReactPlantComposition } from '../../features/plants/plantPigmentationCompositor'

export function PlantVisual({ visual, size = 72 }: { visual: PlantVisualDescriptor; size?: number }) {
  const [failedAssetPath, setFailedAssetPath] = useState<string | null>(null)
  const [composition, setComposition] = useState<{ key: string; source: string } | null>(null)
  const compositionKey = getPlantCompositionKey(visual)
  useEffect(() => {
    let active = true
    const pending = getReactPlantComposition(visual)
    pending?.then((source) => { if (active && compositionKey) setComposition({ key: compositionKey, source }) }).catch(() => {})
    return () => { active = false }
  }, [visual, compositionKey])
  if (visual.baseAsset && failedAssetPath !== visual.baseAsset.path) {
    return <span className="plant-visual__frame" style={{ width: size, height: size }} role="img" aria-label={`${visual.visualStage} ${visual.speciesVisualKey} plant preview`}>
      <img
        src={composition?.key === compositionKey ? composition.source : visual.baseAsset.path}
        alt=""
        onError={() => setFailedAssetPath(visual.baseAsset?.path ?? null)}
        style={{ transform: `rotate(${(visual.variation.orientationIndex - 1) * 2}deg) scale(${1 + visual.variation.scaleBucket * .025})` }}
      />
    </span>
  }
  const button = visual.silhouette === 'button'
  const small = visual.visualStage === 'seedling'
  const normalColors = ['#658b55', '#6c9255', '#5b8254'] as const
  const color = visual.pigmentationRecipeKeys.length ? '#a5ad70' : visual.specialTreatmentKey ? '#91bca1' : normalColors[visual.variation.paletteIndex] ?? normalColors[0]
  const stroke = visual.specialTreatmentKey ? '#d7bc69' : '#314b35'
  return <svg className="plant-visual" width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={`${visual.visualStage} ${visual.speciesVisualKey} plant preview`}>
    <g transform={`translate(40 80) rotate(${(visual.variation.orientationIndex - 1) * 2}) scale(${1 + visual.variation.scaleBucket * .025}) translate(-40 -80)`}>
    {button ? <ellipse cx="40" cy={small ? 64 : 55} rx={small ? 13 : 29} ry={small ? 9 : 19} fill={color} stroke={stroke} strokeWidth="3" />
      : <g fill={color} stroke={stroke} strokeWidth="3" strokeLinejoin="round">
        {!small && <><path d="M31 67 V40 Q31 33 25 33 Q20 33 20 39 V48 Q20 53 29 53" /><path d="M49 67 V45 Q49 38 56 38 Q61 38 61 45 V52 Q61 58 51 58" /></>}
        <rect x={small ? 35 : 29} y={small ? 54 : 12} width={small ? 10 : 22} height={small ? 16 : 57} rx={small ? 5 : 11} />
      </g>}
    {visual.spineRecipeKey && <g stroke="#ddca98" strokeWidth="1.5"><path d="M26 35 l-8 -4 M53 37 l8 -4 M25 54 l-8 2 M54 54 l8 2" /></g>}
    </g>
  </svg>
}
