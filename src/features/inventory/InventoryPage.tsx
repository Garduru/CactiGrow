import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import { TreatmentHistory } from '../lab/TreatmentHistory'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'

export function InventoryPage() {
  const { state } = useGameState()

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
