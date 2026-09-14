import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'

export function TownPage() {
  return (
    <section aria-labelledby="town-title">
      <LocationHeader titleId="town-title" eyebrow="Future shared world" title="Town" subtitle="Town will become CactiGrow's public multiplayer hub for meeting players and visiting shared facilities." />
      <EmptyState title="The road is still being surveyed">
        The Shop and Marketplace will eventually live in an explorable Town scene. Multiplayer, players, chat, trading, and NPCs are not simulated here.
      </EmptyState>
    </section>
  )
}
