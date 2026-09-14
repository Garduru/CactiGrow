import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGameState } from '../../game/useGameState'
import { farmLocations, resolveWorldBuilding } from '../farm/locations'
import { geneticsLabTiers } from '../lab/labConfig'
import { GARDEN_ORGANIZED_BEDS_UPGRADE_ID, getGardenLevelDefinition, getNurseryLevelDefinition, NURSERY_EXPANDED_BENCHES_UPGRADE_ID } from '../property/propertyConfig'
import { getNextPropertyUpgrade, getNurseryCapacity, getPropertyUpgradeStatus } from '../property/propertyModel'
import { farmAccessOptions } from './farmAccess'

type HomeSection = 'property' | 'visitors' | 'social' | 'records'

const homeSections: readonly { id: HomeSection; label: string }[] = [
  { id: 'property', label: 'Property' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'social', label: 'Social' },
  { id: 'records', label: 'Records' },
]

export function HomePage() {
  const location = useLocation()
  const { state, upgradeProperty, setFarmAccessPreference } = useGameState()
  const [section, setSection] = useState<HomeSection>('property')
  const buildings = farmLocations.map((building) => resolveWorldBuilding(building, state.property, state.geneticsLab))
  const currentLab = geneticsLabTiers.find((tier) => tier.id === state.geneticsLab.tier)!
  const nextLab = geneticsLabTiers.find((tier) => tier.id === state.geneticsLab.tier + 1)
  const activeAccess = farmAccessOptions.find((option) => option.id === state.property.farmAccessPreference)!

  return <section className="home-interior" aria-labelledby="home-title">
    <header className="home-heading">
      <div><span className="eyebrow">Property management</span><h1 id="home-title">Home</h1></div>
      <p>Manage your personal Farm, visitor preference, and future social controls.</p>
    </header>

    <nav className="home-nav" aria-label="Home sections">
      {homeSections.map((item) => <button key={item.id} type="button" className={section === item.id ? 'home-nav__item home-nav__item--active' : 'home-nav__item'} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>{item.label}</button>)}
    </nav>

    {section === 'property' && <section className="home-room home-room--property" aria-labelledby="property-title">
      <header><span>Property</span><h2 id="property-title">Your buildings</h2></header>
      <p>Review building levels and available property upgrades.</p>
      <div className="property-building-list">
        {buildings.map((building) => {
          const isLab = building.id === 'lab'
          const isNursery = building.id === 'nursery'
          const isGarden = building.id === 'garden'
          const nurseryDefinition = isNursery ? getNurseryLevelDefinition(state.property.buildings.nursery.level) : null
          const nextNursery = isNursery ? getNextPropertyUpgrade('nursery', state.property.buildings.nursery.level) : null
          const nurseryUpgrade = nextNursery?.implemented ? nextNursery : null
          const gardenDefinition = isGarden ? getGardenLevelDefinition(state.property.buildings.garden.level) : null
          const nextGarden = isGarden ? getNextPropertyUpgrade('garden', state.property.buildings.garden.level) : null
          const gardenUpgrade = nextGarden?.implemented ? nextGarden : null
          const upgrade = nurseryUpgrade ?? gardenUpgrade
          const upgradeStatus = upgrade ? getPropertyUpgradeStatus(state.property, state.player, upgrade.id) : null
          return <article className="property-building" key={building.id}>
            <div><span>{building.displayName}</span><strong>Level {building.level}</strong>{isLab && <small>{currentLab.name}</small>}{nurseryDefinition && <small>{nurseryDefinition.name} · {getNurseryCapacity(state.property)} grow slots</small>}{gardenDefinition && <small>{gardenDefinition.name}</small>}</div>
            <p>{isLab ? nextLab ? `Next: ${nextLab.name} — Level ${nextLab.id}` : 'Maximum configured facility tier' : upgrade ? `Next: ${upgrade.name} — Level ${upgrade.toLevel}` : isNursery ? 'Further Nursery upgrades are not available yet.' : isGarden ? 'Further Garden upgrades are not available yet.' : 'Upgrade path coming later'}</p>
            {isLab && nextLab && <dl><div><dt>Cost</dt><dd>{nextLab.cost.toLocaleString()} Tokens</dd></div><div><dt>Next capability</dt><dd>{nextLab.capabilities[0]}</dd></div></dl>}
            {upgrade && upgradeStatus && <><dl><div><dt>Cost</dt><dd>{upgrade.tokenCost?.toLocaleString()} Tokens</dd></div><div><dt>Requirement</dt><dd>Cultivation Level 10</dd></div><div><dt>Unlocks</dt><dd>{isGarden ? 'Favorites, tags, filters, and collection organization' : upgrade.capabilities[0]}</dd></div></dl><button type="button" className="property-building__upgrade" disabled={!upgradeStatus.eligible} onClick={() => upgradeProperty(isGarden ? GARDEN_ORGANIZED_BEDS_UPGRADE_ID : NURSERY_EXPANDED_BENCHES_UPGRADE_ID)}>{isGarden ? 'Upgrade to Organized Beds' : 'Install Expanded Benches'}</button>{!upgradeStatus.eligible && <span className="property-building__status">{upgradeStatus.reasons.join(' ')}</span>}</>}
            {isGarden && !gardenUpgrade && building.level === 2 && <><strong className="property-building__unlocks-title">Unlocked</strong><ul className="property-building__unlocks">{gardenDefinition?.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></>}
            {isLab ? <Link to="/lab">Manage Lab</Link> : !isNursery && !isGarden && <span className="property-building__status">No additional upgrades configured yet</span>}
          </article>
        })}
      </div>
    </section>}

    {section === 'visitors' && <section className="home-section-grid" aria-labelledby="visitors-title">
      <section className="home-room"><header><span>Visitors</span><h2 id="visitors-title">Farm Access</h2></header><p className="home-prototype-note">Prototype preference only. Multiplayer access is not currently enforced.</p>
        <fieldset className="farm-access"><legend className="sr-only">Choose who may visit your Farm</legend>{farmAccessOptions.map((option) => <label key={option.id} className={state.property.farmAccessPreference === option.id ? 'farm-access__option farm-access__option--selected' : 'farm-access__option'}><input type="radio" name="farm-access" value={option.id} checked={state.property.farmAccessPreference === option.id} onChange={() => setFarmAccessPreference(option.id)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</fieldset>
        <p className="farm-access__status" role="status">Selected: <strong>{activeAccess.label}</strong></p>
      </section>
      <div className="home-section-stack">
        <section className="home-room"><header><span>Boundaries</span><h2>Visitor permissions</h2></header><p>Visitors can walk around and socialize but do not gain control of your Farm.</p><p className="home-compact-note">They cannot plant, harvest, breed, sell, spend Tokens, upgrade buildings, or access private research or inventory.</p></section>
        <section className="home-room"><header><span>Future</span><h2>Farm Invites</h2></header><p>No active Farm invites.</p><p className="home-compact-note">Future invitation controls will appear here.</p></section>
      </div>
    </section>}

    {section === 'social' && <section className="home-section-grid" aria-labelledby="social-title">
      <section className="home-room"><header><span>Connections</span><h2 id="social-title">Friends</h2></header><p>Open Friends for relationship categories and future Farm visit actions.</p><Link className="cg-button cg-button--secondary" to="/friends" state={location.state}>Open Friends</Link></section>
      <section className="home-room"><header><span>Conversations</span><h2>Chat</h2></header><p>Open Chat for the World and Direct Messages UI shells.</p><Link className="cg-button cg-button--secondary" to="/chat" state={location.state}>Open Chat</Link><p className="home-compact-note">Persistent Mail remains separate at the physical Farm Mailbox.</p></section>
    </section>}

    {section === 'records' && <section className="home-room home-room--records" aria-labelledby="records-title"><header><span>Records</span><h2 id="records-title">Property Summary</h2></header><p>Home is Level {state.property.buildings.home.level}. You have {state.property.completedUpgradeIds.length} completed property {state.property.completedUpgradeIds.length === 1 ? 'upgrade' : 'upgrades'}.</p><p className="home-compact-note">More personal and property records will appear here when those systems exist.</p></section>}
  </section>
}
