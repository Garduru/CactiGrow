import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { useTownContent } from './TownContentContext'
import { townPeople } from './townContentPresentation'
import { TOWN_CONTENT } from '../../../shared/api/townContentV1.ts'

export function TownContentJournal() {
  const town = useTownContent(), world = useWorldLocation()
  if (!town.active || !world.location?.discoveredAreaIds.includes(TOWN_CONTENT.areaId)) return null
  const met = town.projection?.contacts.filter(contact => contact.firstMetAt).map(contact => townPeople[contact.entityId].name) ?? []
  return <section className="town-content-journal" aria-labelledby="town-journal-title"><h2 id="town-journal-title">Town</h2><p>Discovered through Path 2. The plaza is a meeting place for growers, with the Shop and Marketplace nearby.</p>{met.length > 0 && <p>Met {met.join(', ')}.</p>}{town.error && !town.projection && <p role="status">{town.error} <button className="cg-button" onClick={() => void town.refresh()}>Retry Town notes</button></p>}</section>
}
