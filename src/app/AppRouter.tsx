import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FarmPage } from '../features/farm/FarmPage'
import { NurseryPage } from '../features/nursery/NurseryPage'
import { BreedingPage } from '../features/breeding/BreedingPage'
import { GardenPage } from '../features/garden/GardenPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { ShopPage } from '../features/shop/ShopPage'
import { MarketplacePage } from '../features/marketplace/MarketplacePage'
import { GameHeader } from '../components/layout/GameHeader'
import { UtilityMenu } from '../components/layout/UtilityMenu'
import { PageLayout } from '../components/layout/PageLayout'
import { AchievementsPage } from '../features/achievements/AchievementsPage'
import { LevelUpNotice } from '../features/progression/LevelUpNotice'
import { SkillsPage } from '../features/progression/SkillsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <GameHeader />
      <main id="main-content" className="game-main">
        <Routes>
          <Route path="/" element={<FarmPage />} />
          <Route path="/farm" element={<Navigate to="/" replace />} />
          <Route path="/collection" element={<Navigate to="/garden" replace />} />
          <Route path="/marketplace" element={<Navigate to="/market" replace />} />
          <Route element={<PageLayout />}>
            <Route path="/nursery" element={<NurseryPage />} />
            <Route path="/breeding" element={<BreedingPage />} />
            <Route path="/garden" element={<GardenPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/market" element={<MarketplacePage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="*" element={<section><h1>Off the beaten path</h1><p>This location doesn’t exist yet.</p></section>} />
          </Route>
        </Routes>
      </main>

      <UtilityMenu />
      <LevelUpNotice />
    </BrowserRouter>
  )
}
