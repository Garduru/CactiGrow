import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'

export function ShopPage() {
  return (
    <section aria-labelledby="shop-title">
      <LocationHeader titleId="shop-title" eyebrow="Farm supply stall" title="Shop" subtitle="Seeds and growing supplies will be stocked here." />
      <EmptyState title="The shopkeeper is preparing stock">
        Purchasing is coming later. Your current inventory and Tokens are unchanged.
      </EmptyState>
    </section>
  )
}
