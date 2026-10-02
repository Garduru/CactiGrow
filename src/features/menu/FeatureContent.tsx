import { ShopPage } from '../shop/ShopPage'
import { MarketplacePage } from '../marketplace/MarketplacePage'
import { InventoryPage } from '../inventory/InventoryPage'
import { PlayerProfilePanel } from '../social/PlayerProfilePanel'
import { FriendsPage } from '../social/FriendsPage'
import { SkillsPage } from '../progression/SkillsPage'
import { FieldJournalPage } from '../journal/FieldJournalPage'
import { ResearchLogPage } from '../research/ResearchLogPage'
import { AchievementsPage } from '../achievements/AchievementsPage'
import { MailPage } from '../mail/MailPage'
import { SettingsPanel, HelpPanel } from './UtilityPanels'
import { PlayerLogout } from '../authentication/PlayerLogout'
import { useFeaturePanel } from './featurePanelState'
import type { FeatureId } from './featurePanelState'

export function FeatureContent({ feature }: { feature: FeatureId }) {
  const { closeFeature } = useFeaturePanel()
  switch (feature) {
    case 'shop': return <ShopPage />
    case 'market': return <MarketplacePage />
    case 'inventory': return <InventoryPage />
    case 'profile': return <PlayerProfilePanel publicId={null} titleId="own-profile-title" />
    case 'friends': return <FriendsPage />
    case 'skills': return <SkillsPage />
    case 'journal': return <FieldJournalPage />
    case 'research': return <ResearchLogPage />
    case 'achievements': return <AchievementsPage />
    case 'mail': return <MailPage />
    case 'help': return <HelpPanel />
    case 'signout': return <PlayerLogout onCancel={closeFeature} />
    case 'settings': return <SettingsPanel />
  }
}
