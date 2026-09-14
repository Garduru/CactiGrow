import { Link } from 'react-router-dom'
import { useGameState } from '../../game/useGameState'
import { farmLocations, resolveWorldBuilding } from '../farm/locations'
import { geneticsLabTiers } from '../lab/labConfig'
import { GARDEN_ORGANIZED_BEDS_UPGRADE_ID, getGardenLevelDefinition, getNurseryLevelDefinition, NURSERY_EXPANDED_BENCHES_UPGRADE_ID } from '../property/propertyConfig'
import { getNextPropertyUpgrade, getNurseryCapacity, getPropertyUpgradeStatus } from '../property/propertyModel'

export function HomePage() {
  const { state, upgradeProperty } = useGameState()
  const buildings = farmLocations.map((building) => resolveWorldBuilding(building, state.property, state.geneticsLab))
  const currentLab = geneticsLabTiers.find((tier) => tier.id === state.geneticsLab.tier)!
  const nextLab = geneticsLabTiers.find((tier) => tier.id === state.geneticsLab.tier + 1)

  return <section className="home-interior" aria-labelledby="home-title">
    <header className="home-heading"><div><span className="eyebrow">Your homestead</span><h1 id="home-title">Home</h1></div><p>A warm base for keeping an eye on the whole cactus property.</p></header>
    <section className="home-room home-room--property" aria-labelledby="property-title">
      <header><span>Property Management</span><h2 id="property-title">Your buildings</h2></header>
      <p>Review building levels and available property upgrades here.</p>
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
    </section>
    <section className="home-room" aria-labelledby="homestead-summary-title"><header><span>Player base</span><h2 id="homestead-summary-title">Homestead Summary</h2></header><p>Home is Level {state.property.buildings.home.level}. Property management is available; additional house progression has not been configured.</p></section>
    <section className="home-room" aria-labelledby="future-home-title"><header><span>Coming later</span><h2 id="future-home-title">Future House Features</h2></header><p>Storage, customization, trophy space, and property-wide conveniences will be designed in later progression passes.</p></section>
  </section>
}
