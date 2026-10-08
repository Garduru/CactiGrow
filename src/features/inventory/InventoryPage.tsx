import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import { TreatmentHistory } from '../lab/TreatmentHistory'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { EquipmentInventory } from '../starting/EquipmentInventory'
import { TutorialMaterials } from '../starting/TutorialMaterials'

export function InventoryPage() {
  const { state } = useGameState()
  const lifecycle = usePlantLifecycle()
  if (lifecycle.state.authority === 'server') {
    if (lifecycle.state.status !== 'ready') return <section aria-labelledby="inventory-title"><LocationHeader titleId="inventory-title" eyebrow="Seed storage" title="Inventory" subtitle={lifecycle.state.status === 'error' ? lifecycle.state.error : 'Loading server inventory…'} /></section>
    const { seedStacks: stacks, bredSeeds } = lifecycle.state.projection
    return <section aria-labelledby="inventory-title"><LocationHeader titleId="inventory-title" eyebrow="Seed storage" title="Inventory" subtitle="Server-authoritative commodity and unique bred seeds." /><TutorialMaterials /><EquipmentInventory /><h2>Regular seeds</h2>{!stacks.some(s => s.quantity > 0) && !bredSeeds.length && <EmptyState title="No regular seeds owned">Tutorial materials above are reserved separately from regular seed stacks.</EmptyState>}<div className="inventory-list">{stacks.filter(item => item.quantity > 0).map((item)=>{const species=getSpeciesById(item.speciesId);return <article className="inventory-item" key={item.speciesId}><div><strong>{species?.commonName ?? item.speciesId} seeds</strong><span>{species?.scientificName ?? 'Commodity seed'}</span></div><span className="inventory-item__quantity">× {item.quantity}</span></article>})}{bredSeeds.map((seed) => <article className="inventory-item inventory-item--bred" key={seed.seedId}><div><strong>{getSpeciesById(seed.speciesId)?.commonName ?? 'Bred offspring'} seed</strong><span>Unique bred seed · {seed.seedId}</span><small>Parents: {seed.parentPlantIds.join(' + ')}</small></div><Badge tone="accent">Bred</Badge></article>)}</div></section>
  }

  return (
    <section aria-labelledby="inventory-title">
      <LocationHeader titleId="inventory-title" eyebrow="Seed storage" title="Inventory" subtitle="Seeds ready for planting and unique offspring from breeding." />
      {!state.inventory.length && !state.bredSeeds.length && <EmptyState title="No seeds available">Visit the Shop when seed purchasing becomes available.</EmptyState>}
      <div className="inventory-list">
        {state.inventory.map((item) => {
          const seedSpecies = item.itemType === 'seed' ? getSpeciesById(item.itemKey) : undefined
          return (
            <article className="inventory-item" key={item.id}>
              <div>
                <strong>{seedSpecies ? `${seedSpecies.commonName} seeds` : item.itemKey}</strong>
                <span>{seedSpecies?.scientificName ?? item.itemType}</span>
              </div>
              <span className="inventory-item__quantity">× {item.quantity}</span>
            </article>
          )
        })}
        {state.bredSeeds.map((seed) => {
          const seedSpecies = getSpeciesById(seed.speciesId)
          return <article className="inventory-item inventory-item--bred" key={seed.id}><div><strong>{seedSpecies?.commonName ?? 'Bred offspring'} seed</strong><span>Unique {seed.isHybrid ? 'hybrid ' : ''}bred seed · {seed.id}</span><small>Parents: {seed.parentPlantIds.join(' + ')}</small><TreatmentHistory treatments={seed.quantitativeTreatments} compact /></div><Badge tone={seed.quantitativeTreatments?.length ? 'warning' : seed.isHybrid ? 'accent' : 'neutral'}>{seed.quantitativeTreatments?.length ? 'Treated' : seed.isHybrid ? 'Hybrid' : 'Bred'}</Badge></article>
        })}
      </div>
    </section>
  )
}
