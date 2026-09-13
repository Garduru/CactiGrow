import { getSpeciesById } from '../../data/species'
import type { InventoryItem } from '../../types/inventory'
import type { BredSeed } from '../../types/bredSeed'

interface SeedPickerProps {
  seeds: InventoryItem[]
  bredSeeds: BredSeed[]
  onSelect: (speciesId: string) => void
  onSelectBredSeed: (seedId: string) => void
  onClose: () => void
}

export function SeedPicker({ seeds, bredSeeds, onSelect, onSelectBredSeed, onClose }: SeedPickerProps) {
  return (
    <div className="seed-picker" role="dialog" aria-modal="true" aria-labelledby="seed-picker-title">
      <button className="seed-picker__backdrop" type="button" onClick={onClose} aria-label="Close seed selection" />
      <section className="seed-picker__panel">
        <div className="seed-picker__heading">
          <div><span className="eyebrow">Mock inventory</span><h2 id="seed-picker-title">Choose a seed</h2></div>
          <button className="seed-picker__close" type="button" onClick={onClose} aria-label="Close seed selection">×</button>
        </div>
        <div className="seed-picker__options">
          {seeds.map((seed) => {
            const seedSpecies = getSpeciesById(seed.itemKey)
            return (
              <button
                className="seed-option"
                key={seed.id}
                type="button"
                disabled={seed.quantity === 0}
                onClick={() => onSelect(seed.itemKey)}
              >
                <span className="seed-option__icon" aria-hidden="true">◉</span>
                <span><strong>{seedSpecies?.commonName ?? 'Unknown seed'}</strong><small>{seedSpecies?.scientificName}</small></span>
                <span className="seed-option__quantity">× {seed.quantity}</span>
              </button>
            )
          })}
          {bredSeeds.map((seed) => {
            const seedSpecies = getSpeciesById(seed.speciesId)
            return <button className="seed-option seed-option--bred" key={seed.id} type="button" onClick={() => onSelectBredSeed(seed.id)}><span className="seed-option__icon" aria-hidden="true">◆</span><span><strong>{seedSpecies?.commonName ?? 'Bred offspring'} seed</strong><small>Unique {seed.isHybrid ? 'hybrid ' : ''}· Parents {seed.parentPlantIds.join(' + ')}</small></span><span className="seed-option__quantity">{seed.isHybrid ? 'Hybrid' : 'Bred'}</span></button>
          })}
        </div>
        <p className="seed-picker__note">Prototype growth is accelerated to about two minutes.</p>
      </section>
    </div>
  )
}
