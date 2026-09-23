import { useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species.ts'
import { getNpcSaleValue } from '../marketplace/sellModel.ts'
import type { CollectedPlant } from '../../game/gameState.ts'
import { useModalFocus } from '../../components/ui/useModalFocus'
import { sellSelectedSpecimens, type MultiSaleResult } from './sellSelectedSpecimens'

interface MultiSellDialogProps {
  selectedSpecimenIds: Set<string>
  ownedPlants: CollectedPlant[]
  onClose: () => void
  onSold: (soldIds: Set<string>) => void
  onSellPlant: (plantId: string) => Promise<boolean>
}

export function MultiSellDialog({ selectedSpecimenIds, ownedPlants, onClose, onSold, onSellPlant }: MultiSellDialogProps) {
  // Freeze the reviewed set; projection refreshes during selling cannot alter it.
  const [selectedPlants] = useState(() => ownedPlants.filter((plant) => selectedSpecimenIds.has(plant.id)))
  const [phase, setPhase] = useState<'confirm' | 'selling' | 'done'>('confirm')
  const [result, setResult] = useState<MultiSaleResult | null>(null)
  const submitting = useRef(false)
  const panelRef = useRef<HTMLElement>(null)
  useModalFocus(panelRef, onClose, phase === 'selling', phase)
  const estimatedTotal = selectedPlants.reduce((sum, plant) => sum + (getNpcSaleValue(plant) ?? 0), 0)

  async function handleSell() {
    if (submitting.current || selectedPlants.length === 0) return
    submitting.current = true
    setPhase('selling')
    const outcome = await sellSelectedSpecimens(selectedPlants.map((plant) => plant.id), onSellPlant)
    setResult(outcome)
    onSold(outcome.sold)
    setPhase('done')
    // Keep the latch closed: this reviewed batch may only be submitted once.
  }

  const complete = result && result.failed.size === 0 && result.unconfirmed.size === 0
  return <div className="multi-sell-overlay" role="presentation">
    <button type="button" aria-label="Close sell workflow" onClick={onClose} disabled={phase === 'selling'} tabIndex={-1} />
    <section className="multi-sell-dialog" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="multi-sell-title" tabIndex={-1}>
      <header className="multi-sell-dialog__header">
        <h2 id="multi-sell-title">{phase === 'confirm' ? `Sell ${selectedPlants.length} ${selectedPlants.length === 1 ? 'specimen' : 'specimens'}` : phase === 'selling' ? 'Selling specimens…' : complete ? 'Sale complete' : 'Sale results'}</h2>
        {phase !== 'selling' && <button type="button" aria-label="Close" onClick={onClose}>&times;</button>}
      </header>
      {phase === 'confirm' && <>
        <div className="multi-sell-dialog__body">
          <div className="multi-sell-specimen-list">{selectedPlants.map((plant) => <div className="multi-sell-specimen-list__item" key={plant.id}>
            {plant.specialVariants.some((variant) => variant.variantId === 'shiny') && <span className="multi-sell-specimen-list__shiny" aria-label="Shiny">★</span>}
            <span className="multi-sell-specimen-list__name">{getSpeciesById(plant.speciesId)?.commonName ?? 'Unknown cactus'}</span>
            <span className="multi-sell-specimen-list__id">Specimen {plant.id.slice(0, 8)}</span>
          </div>)}</div>
          <div className="multi-sell-reward">Estimated total: <strong>{estimatedTotal.toLocaleString()} Tokens</strong></div>
          <p>This permanently removes sold specimens from your Garden.</p>
        </div>
        <footer className="multi-sell-dialog__footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="nursery-button" type="button" onClick={handleSell} disabled={selectedPlants.length === 0}>Confirm sale</button>
        </footer>
      </>}
      {phase === 'selling' && <div className="multi-sell-dialog__body" role="status">Processing your sale. Please wait…</div>}
      {phase === 'done' && result && <>
        <div className="multi-sell-dialog__body" role="status">
          <p className={`multi-sell-status ${complete ? 'success' : 'partial'}`}>
            {result.sold.size} {result.sold.size === 1 ? 'specimen' : 'specimens'} sold.
            {result.failed.size > 0 && <> <span className="failed">{result.failed.size} could not be sold.</span></>}
            {result.unconfirmed.size > 0 && <> {result.unconfirmed.size} sales could not be confirmed. They may have completed; check your Garden and Tokens before retrying.</>}
          </p>
          {!complete && <p>Any remaining owned specimens stay selected for retry. Listed specimens must be unlisted before NPC sale.</p>}
        </div>
        <footer className="multi-sell-dialog__footer"><button className="nursery-button" type="button" onClick={onClose}>Done</button></footer>
      </>}
    </section>
  </div>
}
