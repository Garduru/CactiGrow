import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { GameNav } from '../components/GameNav'
import { FarmPage } from '../features/farm/FarmPage'
import { NurseryPage } from '../features/nursery/NurseryPage'
import { BreedingPage } from '../features/breeding/BreedingPage'
import { CollectionPage } from '../features/collection/CollectionPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { ShopPage } from '../features/shop/ShopPage'
import { MarketplacePage } from '../features/marketplace/MarketplacePage'
import { GameHeader } from '../components/layout/GameHeader'

export function AppRouter() {
  return (
    <BrowserRouter>
      <GameHeader />
      <GameNav />

      <main>
        <Routes>
          <Route path="/" element={<FarmPage />} />
          <Route path="/nursery" element={<NurseryPage />} />
          <Route path="/breeding" element={<BreedingPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}