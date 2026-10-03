import { useEffect, useMemo, useState } from 'react'
import { species, getSpeciesById } from '../data/species'
import { geneticFeatureDefinitions } from '../data/geneticFeatures'
import { NurserySlot } from '../features/nursery/NurserySlot'
import { PlantDetails } from '../features/garden/PlantDetails'
import { createPlantVisualDescriptor } from '../features/plants/plantVisualModel'
import type { GardenDisplayProjection } from '../game-world/worldTypes'
import { GARDEN_DISPLAY_ANCHORS } from '../game-world/gardenDisplayAnchors'
import { createGardenDisplayAssignments } from '../features/garden/gardenDisplayModel'
import type { NurseryPresentationStage } from '../features/nursery/nurseryPresentation'
import type { VariegationPattern, VisualGrowthStage } from '../types/plantVisual'
import { createPlantVisualTestSpecimen, defaultPlantVisualTestConfig, type PlantVisualTestConfig } from './plantVisualTestModel'
import { InspectionPlantPreview, type InspectionZoom } from './InspectionPlantPreview'
import './plantVisualTestTool.css'

const featureIds = ['crested', 'monstrose', 'melted', 'spiral-helical', 'dichotomous', 'dense-spination'] as const
const stages: NurseryPresentationStage[] = ['germinating', 'seedling', 'juvenile', 'developing', 'mature']
const gardenAnchor = GARDEN_DISPLAY_ANCHORS.find((anchor) => anchor.id === 'garden-display-front-center')!

export function PlantVisualTestTool({ onGardenPreview, embedded = false }: { onGardenPreview: (projection: GardenDisplayProjection | null) => void; embedded?: boolean }) {
  const [config, setConfig] = useState<PlantVisualTestConfig>(defaultPlantVisualTestConfig)
  const [frozenNow] = useState(() => Date.now())
  const [target, setTarget] = useState<'nursery' | 'garden' | 'details'>('nursery')
  const [open, setOpen] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [inspectionZoom, setInspectionZoom] = useState<InspectionZoom>(1)
  const plant = useMemo(() => createPlantVisualTestSpecimen(config, frozenNow), [config, frozenNow])
  const visualStage: VisualGrowthStage = config.stage === 'germinating' ? 'seedling' : config.stage
  const visual = useMemo(() => createPlantVisualDescriptor(plant, visualStage, { variegationPattern: config.pattern }), [plant, visualStage, config.pattern])
  const patternLabel = config.pattern.slice(-1).toUpperCase()

  useEffect(() => {
    if (!open || target !== 'garden' || config.stage === 'germinating') {
      onGardenPreview(null)
      return
    }
    onGardenPreview({ slotId: gardenAnchor.id, x: gardenAnchor.x, y: gardenAnchor.y, specimenId: plant.id, visual })
    return () => onGardenPreview(null)
  }, [open, target, config.stage, plant.id, visual, onGardenPreview])

  if (!open) return null

  const update = (change: Partial<PlantVisualTestConfig>) => setConfig((current) => ({ ...current, ...change }))
  const reset = () => { setConfig(defaultPlantVisualTestConfig); setTarget('nursery'); setDetailsOpen(false); setInspectionZoom(1) }

  return <aside className={`plant-test${embedded ? ' plant-test--embedded' : ''}`} aria-label="Development plant visual test tool">
    <header><strong>Plant Visual Test</strong><button type="button" onClick={() => { setDetailsOpen(false); setOpen(false) }} aria-label="Close plant visual test tool">Close</button></header>
    <div className="plant-test__body">
      <label>Species<select value={config.speciesId} onChange={(event) => update({ speciesId: event.target.value })}>{species.map((entry) => <option key={entry.id} value={entry.id}>{entry.commonName}</option>)}</select></label>
      <label>Stage<select value={config.stage} onChange={(event) => update({ stage: event.target.value as NurseryPresentationStage })}>{stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label>
      <label>Pigmentation<select value={config.variegated ? 'variegated' : 'normal'} onChange={(event) => update({ variegated: event.target.value === 'variegated' })}><option value="normal">Normal</option><option value="variegated">Variegated</option></select></label>
      {config.variegated && <label>Requested pattern<select value={config.pattern} onChange={(event) => update({ pattern: event.target.value as VariegationPattern })}><option value="pattern-a">Pattern A</option><option value="pattern-b">Pattern B</option><option value="pattern-c">Pattern C</option></select></label>}
      <fieldset><legend>Features</legend>{featureIds.map((id) => {
        const definition = geneticFeatureDefinitions.find((entry) => entry.id === id)!
        return <label key={id}><input type="checkbox" checked={config.featureIds.includes(id)} onChange={(event) => update({ featureIds: event.target.checked ? [...config.featureIds, id] : config.featureIds.filter((value) => value !== id) })} />{definition.displayName}</label>
      })}</fieldset>
      <label className="plant-test__check"><input type="checkbox" checked={config.shiny} onChange={(event) => update({ shiny: event.target.checked })} />Shiny</label>
      <div className="plant-test__actions"><button type="button" onClick={() => setTarget('nursery')}>Nursery</button><button type="button" onClick={() => setTarget('garden')}>Garden</button><button type="button" onClick={() => { setTarget('details'); setDetailsOpen(true) }}>Plant Details</button></div>
      <section className="plant-test__neutral" aria-label="Neutral resolved plant preview">
        <div className="plant-test__inspection-heading"><div><strong>Neutral art inspection</strong><small>Fit-to-view; not gameplay scale</small></div>{config.stage !== 'germinating' && <div className="plant-test__zoom" role="group" aria-label="Inspection zoom"><button type="button" aria-pressed={inspectionZoom === 1} onClick={() => setInspectionZoom(1)}>Fit</button><button type="button" aria-pressed={inspectionZoom === 1.5} onClick={() => setInspectionZoom(1.5)}>1.5×</button><button type="button" aria-pressed={inspectionZoom === 2} onClick={() => setInspectionZoom(2)}>2×</button></div>}</div>
        {config.stage === 'germinating' ? <span>No visible cactus while germinating.</span> : <InspectionPlantPreview visual={visual} zoom={inspectionZoom} />}
        <span>Requested: {getSpeciesById(config.speciesId)?.commonName ?? config.speciesId} · {config.stage}{config.variegated ? ` · Variegated Pattern ${patternLabel}` : ' · Normal'}</span>
        <span>Rendered base: {visual.baseAsset?.key ?? 'No registered species/stage body'}</span>
      </section>
      {target === 'nursery' && <div className="plant-test__nursery"><NurserySlot slot={{ id: 'dev-test-slot', plant }} slotNumber={1} now={frozenNow} onPlant={() => {}} onCollect={() => {}} readOnly variegationPattern={config.pattern} /></div>}
      {target === 'garden' && <p className="plant-test__note">{config.stage === 'germinating' ? 'Germinating has no visible Garden cactus.' : 'Test specimen projected into the Farm Garden front-center bed. Walk to the Garden to inspect it; real assignments are untouched.'}</p>}
      {config.variegated && <p className="plant-test__note">Pattern {patternLabel}: {visual.pigmentation?.maskAsset ? `resolved ${visual.pigmentation.maskAsset.key}` : 'no compatible runtime mask; approved Normal body remains visible'}.</p>}
      <dl className="plant-test__debug"><div><dt>Specimen</dt><dd>{plant.id}</dd></div><div><dt>Clone</dt><dd>{plant.cloneLineId}</dd></div><div><dt>Visual key</dt><dd>{visual.speciesVisualKey}</dd></div><div><dt>Stage</dt><dd>{config.stage}</dd></div><div><dt>Features</dt><dd>{plant.geneticFeatures.map((feature) => `${feature.featureId} ${feature.expressionStrength}%`).join(', ') || 'none'}</dd></div><div><dt>Shiny</dt><dd>{config.shiny ? 'on' : 'off'}</dd></div><div><dt>Support</dt><dd>{config.stage === 'germinating' ? 'no cactus' : visual.supportState}</dd></div><div><dt>Resolved mask</dt><dd>{visual.pigmentation?.maskAsset?.key ?? 'none'}</dd></div><div><dt>Missing layers</dt><dd>{visual.missingVisualLayers.map((layer) => layer.startsWith('variegation:') ? `Variegation Pattern ${patternLabel}` : layer).join(', ') || 'none'}</dd></div><div><dt>Asset / recipe</dt><dd>{visual.baseAsset?.path ?? visual.baseRecipeKey}</dd></div></dl>
      <button type="button" onClick={reset}>Reset Test Plant</button>
    </div>
    {detailsOpen && <PlantDetails plant={plant} species={getSpeciesById(plant.speciesId)} onClose={() => setDetailsOpen(false)} onBreed={() => {}} onSell={() => {}} onResearch={() => {}} isListed={false} organizationUnlocked={false} onFavoriteChange={() => {}} onAddTag={() => false} onRemoveTag={() => {}} displayAssignments={createGardenDisplayAssignments()} onAssignDisplay={() => {}} onClearDisplay={() => {}} readOnly previewVisualStage={visualStage} previewVariegationPattern={config.pattern} />}
  </aside>
}
