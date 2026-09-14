import { getSpeciesById } from '../../data/species'
import { getActiveListings } from '../../game/gameState'
import { useGameState } from '../../game/useGameState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'

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
      <LocationHeader titleId="market-title" eyebrow="Desert trading post" title="Marketplace" subtitle="Review active listings and manage specimens you have offered for sale." status={<Badge tone="warning">Buying coming later</Badge>} />

      {listings.length === 0 ? (
        <EmptyState title="No active listings">List a specimen from its Garden details to see it here.</EmptyState>
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
                    <Badge tone="success">{listing.status}</Badge>
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
                  <Button className="market-listing__cancel" variant="danger" onClick={() => cancelListing(listing.id)}>
                    Cancel listing
                  </Button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
