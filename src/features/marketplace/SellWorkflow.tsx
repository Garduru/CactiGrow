import { useEffect, useRef, useState } from 'react'
import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import { MAX_LISTING_PRICE, isValidListingPrice } from './marketplaceModel'
import { getNpcSaleValue } from './sellModel'

interface SellWorkflowProps {
  plantId: string
  onClose: () => void
}

type SellMode = 'choose' | 'npc' | 'marketplace'
type Success = { kind: 'npc'; value: number } | { kind: 'marketplace'; price: number }

export function SellWorkflow({ plantId, onClose }: SellWorkflowProps) {
  const { state, sellPlantToNpc, listPlant } = useGameState()
  const [mode, setMode] = useState<SellMode>('choose')
  const [priceInput, setPriceInput] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<Success | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const plant = state.ownedPlants.find((specimen) => specimen.id === plantId)
  const species = plant ? getSpeciesById(plant.speciesId) : undefined
  const npcValue = plant ? getNpcSaleValue(plant) : null

  useEffect(() => {
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!plant && !success) return null

  function confirmNpcSale() {
    const value = sellPlantToNpc(plantId)
    if (value === null) {
      setError('This specimen is no longer available to sell.')
      return
    }
    setSuccess({ kind: 'npc', value })
  }

  function confirmListing() {
    const price = Number(priceInput)
    if (!isValidListingPrice(price)) {
      setError(`Enter a whole Token price from 1 to ${MAX_LISTING_PRICE.toLocaleString()}.`)
      return
    }
    const listing = listPlant(plantId, price)
    if (!listing) {
      setError('This specimen could not be listed. It may no longer be available.')
      return
    }
    setSuccess({ kind: 'marketplace', price })
  }

  return (
    <div className="sell-overlay">
      <button className="plant-details__backdrop" type="button" onClick={onClose} aria-label="Close sell workflow" />
      <section
        className="sell-workflow"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sell-title"
      >
        <header className="plant-details__header">
          <div>
            <span className="eyebrow">Garden specimen</span>
            <h2 id="sell-title">Sell {species?.commonName ?? 'specimen'}</h2>
            {plant && <em>{plant.id}</em>}
          </div>
          <button className="plant-details__close" ref={closeRef} type="button" onClick={onClose} aria-label="Close sell workflow">&times;</button>
        </header>

        {success ? (
          <div className="sell-success" role="status">
            <h3>{success.kind === 'npc' ? 'Specimen sold' : 'Marketplace listing created'}</h3>
            <p>
              {success.kind === 'npc'
                ? `${success.value.toLocaleString()} Tokens were added to your balance.`
                : `The specimen is listed for ${success.price.toLocaleString()} Tokens.`}
            </p>
            <button className="nursery-button" type="button" onClick={onClose}>Finish</button>
          </div>
        ) : mode === 'choose' ? (
          <div className="sell-choices">
            <button type="button" onClick={() => { setMode('npc'); setError('') }}>
              <strong>Sell to NPC</strong>
              <span>Receive {npcValue?.toLocaleString() ?? 0} Tokens immediately.</span>
            </button>
            <button type="button" onClick={() => { setMode('marketplace'); setError('') }}>
              <strong>List on Marketplace</strong>
              <span>Set an asking price and lock this specimen until cancelled.</span>
            </button>
          </div>
        ) : mode === 'npc' ? (
          <div className="sell-confirmation">
            <h3>NPC sale</h3>
            <dl>
              <div><dt>Species</dt><dd>{species?.commonName ?? 'Unknown cactus'}</dd></div>
              <div><dt>Sale price</dt><dd>{npcValue?.toLocaleString()} Tokens</dd></div>
            </dl>
            <p className="sell-warning">This permanently removes the specimen from your Garden.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="sell-controls">
              <button type="button" onClick={() => setMode('choose')}>Back</button>
              <button className="nursery-button" type="button" onClick={confirmNpcSale}>Confirm NPC sale</button>
            </div>
          </div>
        ) : (
          <form className="sell-confirmation" onSubmit={(event) => { event.preventDefault(); confirmListing() }}>
            <h3>Marketplace listing</h3>
            <label htmlFor="listing-price">Asking price in Tokens</label>
            <input
              id="listing-price"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_LISTING_PRICE}
              step="1"
              value={priceInput}
              onChange={(event) => { setPriceInput(event.target.value); setError('') }}
              autoFocus
            />
            <small>Whole Tokens only. Maximum {MAX_LISTING_PRICE.toLocaleString()}.</small>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="sell-controls">
              <button type="button" onClick={() => setMode('choose')}>Back</button>
              <button className="nursery-button" type="submit">Create listing</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
