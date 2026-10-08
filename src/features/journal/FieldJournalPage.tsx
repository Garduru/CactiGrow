import { ProgressBar } from '../../components/ui/ProgressBar'
import { species } from '../../data/species'
import { useGameState } from '../../game/useGameState'
import { discoverySourceLabels, getDiscoveredSpeciesCount, getJournalCompletion, getShinyDiscoveryCount } from './journalModel'
import { ExplorationJournal } from '../exploration/ExplorationJournal'
import { FieldSurveyJournal } from '../field-survey/FieldSurveyJournal'
import { TownContentJournal } from '../town-content/TownContentJournal'

export function FieldJournalPage() {
  const { state } = useGameState()
  const discoveredCount = getDiscoveredSpeciesCount(state.speciesDiscoveries)
  const completion = getJournalCompletion(discoveredCount, species.length)

  return (
    <section aria-labelledby="journal-title">
      <div className="journal-heading">
        <div>
          <span className="eyebrow">Botanical record</span>
          <h1 id="journal-title">Field Journal</h1>
        </div>
        <strong>{discoveredCount} / {species.length} species discovered</strong>
      </div>

      <div className="journal-summary" aria-label="Field Journal summary">
        <div>
          <span>Completion</span>
          <strong>{completion}%</strong>
        </div>
        <div>
          <span>Shiny discoveries</span>
          <strong>{getShinyDiscoveryCount(state.journalStats)}</strong>
        </div>
        <ProgressBar
          value={discoveredCount}
          max={species.length}
          label="Species"
          ariaLabel="Species discovery progress"
          ariaValueText={`${discoveredCount} of ${species.length} species discovered, ${completion}% complete`}
        />
      </div>

      <div className="journal-grid">
        {species.map((catalogSpecies, index) => {
          const discovery = state.speciesDiscoveries[catalogSpecies.id]
          if (!discovery) {
            return (
              <article className="journal-entry journal-entry--unknown" key={catalogSpecies.id}>
                <div className="journal-entry__unknown-art" aria-hidden="true">?</div>
                <span>Entry {index + 1}</span>
                <h2>???</h2>
                <strong>Undiscovered</strong>
                <p>Encounter this cactus through gameplay to reveal its botanical record.</p>
              </article>
            )
          }

          return (
            <article className="journal-entry journal-entry--discovered" key={catalogSpecies.id}>
              <div className="journal-entry__plant-art" aria-hidden="true"><span /></div>
              <span>Discovered</span>
              <h2>{catalogSpecies.commonName}</h2>
              <em>{catalogSpecies.scientificName}</em>
              <dl>
                <div><dt>Genus</dt><dd>{catalogSpecies.genus}</dd></div>
                <div><dt>Rarity</dt><dd>{catalogSpecies.rarity}</dd></div>
                <div><dt>First found</dt><dd><time dateTime={discovery.firstDiscoveredAt}>{new Date(discovery.firstDiscoveredAt).toLocaleDateString()}</time></dd></div>
                <div><dt>Source</dt><dd>{discoverySourceLabels[discovery.discoverySource]}</dd></div>
              </dl>
            </article>
          )
        })}
      </div>
      <FieldSurveyJournal />
      <TownContentJournal />
      <ExplorationJournal />
    </section>
  )
}
