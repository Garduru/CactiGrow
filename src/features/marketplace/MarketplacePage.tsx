import { getSpeciesById } from '../../data/species'
import { getActiveListings } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'

const traits = [
  ['Vigor', 'vigor'],
  ['Growth', 'growthSpeed'],
  ['Size', 'size'],
  ['Flowering', 'flowering'],
  ['Mutation', 'mutationChance'],
] as const

export function MarketplacePage() {
  const { state, cancelListing } = useGameState()
  const listings = getActiveListings(state.marketplaceListings)

  return (
    <section aria-labelledby="market-title">
      <h1 id="market-title">Marketplace</h1>
      <p>Active local prototype listings. Player-to-player purchasing is not available yet.</p>

      {listings.length === 0 ? (
        <div className="market-empty">
          <strong>No active listings</strong>
          <span>List a specimen from its Garden details.</span>
        </div>
      ) : (
        <div className="market-listings">
          {listings.map((listing) => {
            const plant = state.ownedPlants.find((specimen) => specimen.id === listing.plantId)
            const species = plant ? getSpeciesById(plant.speciesId) : undefined
            const isOwnListing = listing.sellerId === state.player.id

            return (
              <article className="market-listing" key={listing.id}>
                <header>
                  <div>
                    <span className="nursery-stage">{listing.status}</span>
                    <h2>{species?.commonName ?? 'Unavailable specimen'}</h2>
                    {species?.scientificName && <em>{species.scientificName}</em>}
                  </div>
                  <strong className="market-listing__price">{listing.askingPrice.toLocaleString()} Tokens</strong>
                </header>
                <dl className="market-listing__meta">
                  <div><dt>Specimen</dt><dd>{listing.plantId}</dd></div>
                  <div><dt>Seller</dt><dd>{isOwnListing ? `${state.player.username} (You)` : listing.sellerId}</dd></div>
                  <div><dt>Listed</dt><dd>{new Date(listing.createdAt).toLocaleString()}</dd></div>
                </dl>
                {plant && (
                  <div className="market-listing__traits" aria-label="Specimen genetics">
                    {traits.map(([label, key]) => <span key={key}>{label} <b>{plant.genetics[key]}</b></span>)}
                  </div>
                )}
                {isOwnListing && (
                  <button className="market-listing__cancel" type="button" onClick={() => cancelListing(listing.id)}>
                    Cancel listing
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
