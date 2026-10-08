import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { StartingDevInspection } from '../starting/StartingDevInspection'
import { StartingResetControl } from '../starting/StartingResetControl'
import { findArea, WORLD } from '../../../shared/world/world'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { DevCommand, DevCommandInput, DevSpecimenDiagnostics } from '../../../shared/api/devToolsV1'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { devToolsAvailable, getDeploymentMode } from '../../config/deploymentMode'
import { useGameState } from '../../game/useGameState'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { useSocialState } from '../social/useSocialState'
import { useFeaturePanel } from '../menu/featurePanelState'
import { skillDefinitions } from '../progression/skillDefinitions'
import { getProgressionSnapshot } from '../progression/progressionModel'
import { getTotalLevel, publicSkillsFromPlayer } from '../progression/publicSkills'
import { GARDEN_ORGANIZED_BEDS_UPGRADE_ID } from '../property/propertyConfig'
import { getPropertyUpgradeStatus } from '../property/propertyModel'
import { getSpeciesById } from '../../data/species'
import { isEligibleForResearch, researchStatus } from '../garden/collectionManagement'
import { getNextResearchStep, projectGeneticKnowledge } from '../research/researchModel'
import { GeneticKnowledgeView } from '../research/GeneticKnowledgeView'
import { canBreed } from '../breeding/breedingModel'
import { PlantVisualTestTool } from '../../dev/PlantVisualTestTool'
import { WorldEditorPanel } from '../../game-world/editor/WorldEditorPanel'
import type { WorldEditorController } from '../../game-world/editor/worldEditorState'
import { getWorldDiagnostics, setGardenPreview, type WorldDiagnosticSnapshot } from './worldDiagnostics'
import { createDebugSnapshot } from './debugSnapshot'
import './devTools.css'

const sections = ['Overview', 'Progression', 'Economy', 'Inventory', 'Plants', 'Research & Breeding', 'World', 'Social', 'Visual Testing', 'System'] as const
type Section = typeof sections[number]
const sessionLog: string[] = []
function Facts({ values }: { values: Record<string, unknown> }) {
  return <dl className="dev-tools__facts">{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === null || value === undefined ? 'Unavailable' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
}
function AmountControl({ label, presets, min = 1, max, disabled, submit }: { label: string; presets: number[]; min?: number; max: number; disabled: boolean; submit(amount: number): void }) {
  const [amount, setAmount] = useState(String(presets[0]))
  const value = Number(amount)
  return <div className="dev-tools__amount"><div className="dev-tools__buttons">{presets.map(n => <button key={n} disabled={disabled} onClick={() => submit(n)}>+{n.toLocaleString()}</button>)}</div><form onSubmit={e => { e.preventDefault(); if (Number.isSafeInteger(value) && value >= min && value <= max && value !== 0) submit(value) }}><label>{label}<input type="number" min={min} max={max} step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label><button disabled={disabled || !Number.isSafeInteger(value) || value < min || value > max || value === 0}>Apply</button></form></div>
}

export function DevToolsPanel() {
  return devToolsAvailable() ? <DevToolsContent /> : null
}
function DevToolsContent() {
  const game = useGameState(), { state } = game
  const grower = useGrowerAuthority(), lifecycle = usePlantLifecycle(), bootstrap = usePlayerBootstrap(), social = useSocialState()
  const { openFeature, worldPreview, setWorldPreview } = useFeaturePanel()
  const location = useLocation()
  const foundation = useWorldLocation()
  const [section, setSection] = useState<Section>(() => new URLSearchParams(location.search).has('plantTest') ? 'Visual Testing' : new URLSearchParams(location.search).has('worldEdit') ? 'World' : 'Overview')
  const [session, setSession] = useState<Awaited<ReturnType<typeof browserApiClient.getDevSession>> | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [busy, setBusy] = useState(false), busyRef = useRef(false)
  const [message, setMessage] = useState('')
  const [log, setLog] = useState([...sessionLog])
  const [world, setWorld] = useState<WorldDiagnosticSnapshot | null>(() => getWorldDiagnostics()?.read() ?? null)
  const [editor, setEditor] = useState<WorldEditorController | null>(null)
  const [debugVisible, setDebugVisible] = useState(false)
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof browserApiClient.getShopCatalog>> | null>(null)
  const [speciesId, setSpeciesId] = useState('')
  const [query, setQuery] = useState(''), [selectedId, setSelectedId] = useState(''), [partnerId, setPartnerId] = useState('')
  const [commerce, setCommerce] = useState<DevSpecimenDiagnostics | null>(null)
  const [commerceError, setCommerceError] = useState('')
  const [retry, setRetry] = useState<{ command: DevCommand; label: string } | null>(null)
  const authorityReady = grower.state.authority === 'server' && grower.state.status === 'ready' && lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready'
  const enabled = !!session && authorityReady && !busy
  const publicName = social.state.status === 'ready' ? social.state.overview.ownProfile?.displayName ?? null : null
  const playerId = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null

  useEffect(() => {
    const controller = new AbortController()
    void browserApiClient.getDevSession(controller.signal).then(setSession).catch((error: unknown) => { if (!controller.signal.aborted) setSessionError(error instanceof Error ? error.message : 'Developer API unavailable.') })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const timer = setInterval(() => setWorld(getWorldDiagnostics()?.read() ?? null), 500)
    return () => { clearInterval(timer); setGardenPreview(null) }
  }, [])
  useEffect(() => {
    if (section !== 'Inventory' || catalog || !session) return
    const controller = new AbortController()
    void browserApiClient.getShopCatalog(controller.signal).then(setCatalog).catch((error: unknown) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Catalog unavailable.') })
    return () => controller.abort()
  }, [section, catalog, session])
  useEffect(() => () => { editor?.setMode('test'); editor?.select(null) }, [editor])
  useEffect(() => { if (section !== 'World' && section !== 'Visual Testing') setWorldPreview(false) }, [section, setWorldPreview])

  const specimens = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? [...lifecycle.state.projection.ownedSpecimens, ...lifecycle.state.projection.nursery.slots.flatMap(s => s.occupancy ? [s.occupancy.specimen] : [])] : []
  const selected = specimens.find(p => p.specimenId === selectedId)
  const plant = state.ownedPlants.find(p => p.id === selectedId)
  const partner = state.ownedPlants.find(p => p.id === partnerId)
  const geneticsLevel = getProgressionSnapshot(state.player.skills.genetics.xp).level
  const record = plant ? state.geneticsResearch.records[plant.cloneLineId] : undefined
  const nextResearch = getNextResearchStep(record)
  const researchEligible = !!plant && isEligibleForResearch(plant, record, geneticsLevel)
  const upgrade = getPropertyUpgradeStatus(state.property, state.player, GARDEN_ORGANIZED_BEDS_UPGRADE_ID)
  useEffect(() => {
    if (!session || !selectedId || !['Plants', 'Research & Breeding'].includes(section)) return
    const controller = new AbortController()
    void browserApiClient.getDevSpecimen(selectedId, controller.signal).then(result => { setCommerce(result); setCommerceError('') }).catch((error: unknown) => { if (!controller.signal.aborted) { setCommerce(null); setCommerceError(error instanceof Error ? error.message : 'Diagnostics unavailable.') } })
    return () => controller.abort()
  }, [session, selectedId, section, state.gardenOrganization, state.marketplaceListings])

  function recordAction(label: string) {
    sessionLog.unshift(`${new Date().toLocaleTimeString()} ${label}`); sessionLog.splice(40)
    setLog([...sessionLog]); setMessage(label)
  }
  async function action(label: string, work: () => Promise<unknown> | unknown) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try { const result = await work(); if (result === false || result === null) throw new Error('Action rejected by the current gameplay rules.'); recordAction(label) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function send(command: DevCommand, label: string) {
    return action(label, async () => {
      setRetry({ command, label })
      let result
      try { result = await browserApiClient.executeDevCommand(command) }
      catch (error) {
        if (error instanceof CactiGrowApiError && error.status && error.status >= 400 && error.status < 500) setRetry(null)
        throw error
      }
      grower.applyProjection(result.grower); lifecycle.applyProjection(result.lifecycle)
      setRetry(null)
    })
  }
  function mutate(input: DevCommandInput, label: string) { if (enabled && !retry) void send({ ...input, commandId: crypto.randomUUID() }, label) }
  const snapshot = () => createDebugSnapshot({ environment: getDeploymentMode(), version: session?.version ?? null, playerId, name: publicName, route: location.pathname, world: getWorldDiagnostics()?.read() ?? null, skills: state.player.skills, currency: state.player.tokens, gardenLevel: state.property.buildings.garden.level, bootstrap: bootstrap.status, authority: grower.state.authority })
  const selector = <><label>Find specimen<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Species or specimen UUID" /></label><label>Owned specimen<select value={selected?.specimenId ?? ''} onChange={e => setSelectedId(e.target.value)}><option value="">Select specimen</option>{specimens.filter(p => `${p.specimenId} ${getSpeciesById(p.speciesId)?.commonName}`.toLowerCase().includes(query.toLowerCase()) || p.specimenId === selectedId).map(p => <option key={p.specimenId} value={p.specimenId}>{getSpeciesById(p.speciesId)?.commonName} · {p.specimenId} · {p.lifecycleStatus}</option>)}</select></label></>

  return <div className="dev-tools">
    <nav className="dev-tools__nav" aria-label="Developer tool sections">{sections.map(item => <button key={item} aria-pressed={item === section} onClick={() => setSection(item)}>{item}</button>)}</nav>
    <div className="dev-tools__body">
      <StartingDevInspection />
      {section === 'System' && <StartingResetControl playerId={playerId} enabled={enabled} recordAction={recordAction} />}
      <p className="dev-tools__status">{getDeploymentMode()} · {authorityReady ? 'Authoritative gameplay' : 'Read-only prototype / loading'} · {session ? 'Developer API authenticated' : sessionError || 'Checking developer API…'}</p>
      {(section === 'World' || section === 'Visual Testing') && <button aria-pressed={worldPreview} onClick={() => setWorldPreview(!worldPreview)}>{worldPreview ? 'Return to modal panel' : 'Dock panel for world preview'}</button>}
      {!authorityReady && <p>Gameplay mutations require the existing server-lifecycle session. For local development, open the bookmarked <code>/play?developmentIdentity=account-a&amp;e1Lifecycle=server</code> using the isolated local launcher.</p>}
      {retry && <div role="alert"><p>A command has an unresolved result. Retry uses the exact same command ID and body.</p><button disabled={busy} onClick={() => void send(retry.command, retry.label)}>Retry command</button><button disabled={busy} onClick={() => { setRetry(null); setMessage('Command dismissed. Verify authoritative state before repeating an adjustment.') }}>Dismiss</button></div>}
      <fieldset disabled={busy || !!retry} className="dev-tools__section">
        {section === 'Overview' && <><Facts values={{ Environment: getDeploymentMode(), Player: publicName, 'Internal UUID': playerId, World: world?.world, Area: world?.area, Position: world?.position, 'Total level': getTotalLevel(publicSkillsFromPlayer(state.player.skills)), Currency: `$${state.player.tokens.toLocaleString()}`, 'Garden level': state.property.buildings.garden.level, Multiplayer: world?.multiplayer?.status, Layer: world?.multiplayer?.layer, 'Worker version': session?.version }} /><div className="dev-tools__buttons"><button disabled={!playerId} onClick={() => void action('Copied player UUID', () => navigator.clipboard.writeText(playerId!))}>Copy player UUID</button><button onClick={() => social.openProfile(null)}>Open own profile</button></div></>}
        {section === 'Progression' && <>{skillDefinitions.map(skill => { const progress = getProgressionSnapshot(state.player.skills[skill.id].xp); return <section className="dev-tools__card" key={skill.id}><h3>{skill.name}</h3><Facts values={{ XP: progress.totalXp, Level: progress.level, 'XP to next level': progress.remainingXp }} /><AmountControl label="Custom XP" presets={[10, 100, 1000]} max={1_000_000} disabled={!enabled} submit={amount => mutate({ type: 'add-xp', skillId: skill.id, amount }, `Added ${amount} ${skill.name} XP`)} /></section> })}<section className="dev-tools__card"><h3>Garden progression</h3><p>Garden Level {state.property.buildings.garden.level}. Garden has building upgrades, no separate XP.</p><p>{state.property.buildings.garden.level >= 2 ? 'Organized Beds unlocked: tags, batch research, breeding shortlists.' : upgrade.reasons.join(' ') || 'Organized Beds available through the normal upgrade.'}</p><button disabled={!enabled || !upgrade.eligible} onClick={() => void action('Purchased Organized Beds through normal gameplay', () => game.upgradeProperty(GARDEN_ORGANIZED_BEDS_UPGRADE_ID))}>Buy Organized Beds (${upgrade.definition?.tokenCost})</button></section></>}
        {section === 'Economy' && <><h3>Current balance: ${state.player.tokens.toLocaleString()}</h3><AmountControl label="Custom currency ($)" presets={[100, 1000, 10000]} max={100_000} disabled={!enabled} submit={amount => mutate({ type: 'add-currency', amount }, `Added $${amount.toLocaleString()}`)} /></>}
        {section === 'Inventory' && <><label>Seed<select value={speciesId || catalog?.items[0]?.speciesId || ''} onChange={e => setSpeciesId(e.target.value)}>{catalog?.items.map(item => <option key={item.id} value={item.speciesId}>{item.name}</option>)}</select></label><Facts values={Object.fromEntries(state.inventory.filter(i => i.itemType === 'seed').map(i => [getSpeciesById(i.itemKey)?.commonName ?? i.itemKey, i.quantity]))} /><AmountControl label="Custom quantity (negative removes seeds)" presets={[1, 10, 100]} min={-100} max={100} disabled={!enabled || !catalog} submit={amount => { if (amount < 0 && !window.confirm(`Remove ${-amount} seeds from this development player?`)) return; const id = speciesId || catalog!.items[0].speciesId; mutate({ type: 'adjust-seeds', speciesId: id, amount }, `${amount < 0 ? 'Removed' : 'Added'} ${Math.abs(amount)} ${getSpeciesById(id)?.commonName} seeds`) }} /></>}
        {section === 'Plants' && <>{selector}{selected && <><Facts values={{ ID: selected.specimenId, Species: getSpeciesById(selected.speciesId)?.commonName, Owner: playerId, 'Clone line': selected.cloneLineId, Lifecycle: selected.lifecycleStatus, 'Planted at': selected.plantedAt, 'Collected at': selected.collectedAt, 'Parent IDs': selected.parentPlantIds, 'Genetic identity (dev)': selected.genetics, 'Features (dev)': selected.geneticFeatures, 'Special variants': selected.specialVariants, Favorite: state.gardenOrganization[selectedId]?.favorite ?? false, Research: researchStatus(record) }} /><p>Commerce: {commerce?.specimenId === selectedId ? commerce.reason : commerceError || 'Loading…'}</p>{commerce?.specimenId === selectedId && <Facts values={{ 'NPC sale eligible': commerce.npcSaleEligible, 'Marketplace eligible': commerce.listingEligible, 'NPC value (server)': commerce.npcValue, 'Active listing': commerce.activeListingId }} />}<div className="dev-tools__buttons"><button disabled={!enabled || selected.lifecycleStatus !== 'growing'} onClick={() => mutate({ type: 'advance-growth', specimenId: selectedId, minutes: 1 }, `Advanced ${selectedId} growth by 1 minute`)}>Advance +1 minute</button><button disabled={!enabled || selected.lifecycleStatus !== 'growing'} onClick={() => mutate({ type: 'advance-growth', specimenId: selectedId, minutes: 'complete' }, `Completed ${selectedId} growth schedule`)}>Complete growth</button><button disabled={!enabled || !plant || !!commerce?.activeListingId} onClick={() => void action('Updated specimen Favorite', () => game.setGardenFavorite(selectedId, !state.gardenOrganization[selectedId]?.favorite))}>Toggle Favorite</button></div><p>Growing specimens are collected through the normal Nursery flow. Test specimens are created by adding seeds and planting through that flow.</p></>}</>}
        {section === 'Research & Breeding' && <>{selector}{plant ? <><Facts values={{ Research: researchStatus(record), 'Next milestone': nextResearch.label, 'Required Genetics level': nextResearch.requiredLevel, 'Research eligible': researchEligible, 'Research unavailable reason': researchEligible ? 'Eligible' : record?.analysisDepth === 'fully-characterized' ? 'Research complete' : `Requires Genetics level ${nextResearch.requiredLevel}`, 'Breeding listed': plant.isListedForSale, 'Favorite donor retained': state.gardenOrganization[selectedId]?.favorite ?? false }} /><button disabled={!enabled || !researchEligible} onClick={() => void action('Researched selected specimen through normal gameplay', () => record ? game.analyzePlant(selectedId) : game.observePlant(selectedId))}>Research selected specimen</button><GeneticKnowledgeView knowledge={projectGeneticKnowledge(plant, record, geneticsLevel)} /><label>Breeding partner<select value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">Choose partner</option>{state.ownedPlants.filter(p => p.id !== selectedId).map(p => <option key={p.id} value={p.id}>{getSpeciesById(p.speciesId)?.commonName} · {p.id}</option>)}</select></label><p>{canBreed(plant, partner) ? 'Pair eligible to breed through the normal confirmed Garden workflow.' : !partner ? 'Choose a second owned collected specimen.' : plant.isListedForSale || partner.isListedForSale ? 'Cancel active listings before breeding.' : 'Pair must be different mature specimens from the same genus.'}</p></> : <p>Select a collected owned specimen to inspect research and breeding.</p>}</>}
        {section === 'World' && <>{foundation.active && foundation.location && <Facts values={{ Zone: foundation.location.zoneId, 'Area template': foundation.location.areaId, 'Runtime instance': foundation.location.runtimeAreaId, Entry: foundation.location.entryId, Exits: findArea(foundation.location.areaId)?.exits.map(e => e.exitId + (e.blocked ? ' (blocked)' : '')), 'LDtk build': WORLD.version }} />}<Facts values={{ World: world?.world, Area: world?.area, 'Session ID': world?.sessionId, Position: world?.position, Destination: world?.destination, 'Path waypoints': world?.waypoints, Multiplayer: world?.multiplayer }} /><button disabled={!world} onClick={() => void action(`Reset position to ${world?.world} safe spawn`, () => getWorldDiagnostics()?.resetPosition() ?? false)}>Reset to current world spawn</button><button disabled={!world} aria-pressed={debugVisible} onClick={() => { const handle = getWorldDiagnostics(); if (handle) { handle.setDebugVisible(!debugVisible); setDebugVisible(!debugVisible); recordAction(`${debugVisible ? 'Hidden' : 'Shown'} collision and navigation debug`) } }}>Toggle collision / path debug</button><button disabled={!world} onClick={() => { const handle = getWorldDiagnostics(); if (handle) setEditor(handle.enableEditor()) }}>Open existing World Editor</button>{editor && <WorldEditorPanel editor={editor} world={world?.world ?? 'World'} />}</>}
        {section === 'Social' && <>{social.state.status === 'ready' && <Facts values={{ Name: publicName, Friends: social.state.overview.friends.length, 'Incoming requests': social.state.overview.incomingRequests.length, Blocked: social.state.overview.blockedPlayers.length }} />}<button onClick={() => social.openProfile(null)}>Open own public profile</button><button onClick={() => openFeature('friends')}>Open Friends</button></>}
        {section === 'Visual Testing' && <><p>Isolated art preview. Does not create a gameplay specimen or award progression.</p><PlantVisualTestTool embedded onGardenPreview={setGardenPreview} /></>}
        {section === 'System' && <><Facts values={{ Environment: getDeploymentMode(), 'Worker version': session?.version, 'API health': session ? 'Authenticated developer API reachable' : sessionError || 'Checking', Auth: bootstrap.status, 'Grower bootstrap': grower.state.authority === 'server' ? grower.state.status : 'local prototype', Route: location.pathname, 'Feature panel': 'devtools', 'World session': world?.sessionId }} /><button onClick={() => void action('Copied clean debug snapshot', () => navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2)))}>Copy Debug Snapshot</button><details><summary>Inspect diagnostic snapshot</summary><pre>{JSON.stringify(snapshot(), null, 2)}</pre></details></>}
      </fieldset>
      <p role="status">{message}</p>
      <details className="dev-tools__log" open><summary>Session action log ({log.length})</summary>{log.length ? <ol>{log.map((entry, i) => <li key={`${i}-${entry}`}>{entry}</li>)}</ol> : <p>No actions yet.</p>}</details>
    </div>
  </div>
}
