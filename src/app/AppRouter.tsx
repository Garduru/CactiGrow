import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NurseryPage } from '../features/nursery/NurseryPage'
import { BreedingPage } from '../features/breeding/BreedingPage'
import { GardenPage } from '../features/garden/GardenPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { ShopPage } from '../features/shop/ShopPage'
import { MarketplacePage } from '../features/marketplace/MarketplacePage'
import { PageLayout } from '../components/layout/PageLayout'
import { AchievementsPage } from '../features/achievements/AchievementsPage'
import { SkillsPage } from '../features/progression/SkillsPage'
import { FieldJournalPage } from '../features/journal/FieldJournalPage'
import { ResearchLogPage } from '../features/research/ResearchLogPage'
import { GeneticsLabPage } from '../features/lab/GeneticsLabPage'
import { HomePage } from '../features/home/HomePage'
import { MailPage } from '../features/mail/MailPage'

import { PlayerLogin } from '../features/authentication/PlayerLogin'
import { GameSession } from './GameSession'
import { OfficialHomePage } from '../features/website/OfficialHomePage'
import { CANONICAL_FARM_PATH } from './farmReturnNavigation'
import { FeatureContent } from '../features/menu/FeatureContent'

const FarmWorldPage = lazy(() => import('../game-world/FarmWorldPage').then((module) => ({ default: module.FarmWorldPage })))
const TownWorldPage = lazy(() => import('../game-world/TownWorldPage').then((module) => ({ default: module.TownWorldPage })))

export function AppRouter() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OfficialHomePage />} />
      <Route path="/auth/reset-password" element={<PlayerLogin />} />
      <Route element={<GameSession />}>
        <Route path={CANONICAL_FARM_PATH} element={<Suspense fallback={<p className="world-page__loading">Loading Farm…</p>}><FarmWorldPage /></Suspense>} />
        <Route path="/farm" element={<LegacyRedirect to={CANONICAL_FARM_PATH} />} />
        <Route path="/world-preview" element={<LegacyRedirect to={CANONICAL_FARM_PATH} />} />
        <Route path="/town" element={<Suspense fallback={<p className="world-page__loading">Loading Town renderer…</p>}><TownWorldPage /></Suspense>} />
        <Route path="/collection" element={<LegacyRedirect to="/garden" />} />
        <Route path="/marketplace" element={<LegacyRedirect to="/market" />} />
        <Route element={<PageLayout />}>
          <Route path="/nursery" element={<NurseryPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/breeding" element={<BreedingPage />} />
          <Route path="/garden" element={<GardenPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/market" element={<MarketplacePage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/journal" element={<FieldJournalPage />} />
          <Route path="/research" element={<ResearchLogPage />} />
          <Route path="/lab" element={<GeneticsLabPage />} />
          <Route path="/mail" element={<MailPage />} />
          <Route path="/friends" element={<FeatureContent feature="friends" />} />
          <Route path="/profile" element={<FeatureContent feature="profile" />} />
          <Route path="/help" element={<FeatureContent feature="help" />} />
          <Route path="/settings" element={<FeatureContent feature="settings" />} />
          <Route path="/chat" element={<LegacyRedirect to={CANONICAL_FARM_PATH} />} />
          <Route path="*" element={<section><h1>Off the beaten path</h1><p>This location doesn’t exist yet.</p></section>} />
        </Route>
      </Route>
    </Routes>
  )
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} state={location.state} replace />
}
