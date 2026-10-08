import { Badge } from '../../components/ui/Badge'
import { useStartingExperience } from './StartingContext'

export function TutorialMaterials() {
  const tutorial = useStartingExperience(), state = tutorial.state
  if (!tutorial.active || !state || (!state.tutorialSeedAvailable && !state.farmSeedAvailable)) return null
  return <section className="tutorial-materials" aria-label="Tutorial materials">
    <h2>Tutorial materials</h2>
    <div className="inventory-list">
      {state.tutorialSeedAvailable && <article className="inventory-item inventory-item--tutorial" aria-label="San Pedro tutorial seed">
        <div><strong>San Pedro tutorial seed</strong><span>Owned · Reserved for the Path 1 tutorial pot</span><small>Harvested from Wild San Pedro. Tutorial only; cannot be sold, mailed or traded.</small></div>
        <span className="inventory-item__quantity">× 1</span><Badge tone="accent">Reserved</Badge>
      </article>}
      {state.farmSeedAvailable && <article className="inventory-item inventory-item--tutorial" aria-label="San Pedro Farm practice seed">
        <div><strong>San Pedro Farm practice seed</strong><span>Owned · Reserved for your first Nursery lesson</span><small>Creates a tutorial plant on the normal Nursery schedule. Cannot be sold, mailed or traded.</small></div>
        <span className="inventory-item__quantity">× 1</span><Badge tone="accent">Reserved</Badge>
      </article>}
    </div>
  </section>
}
