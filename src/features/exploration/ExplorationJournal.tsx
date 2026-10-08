import { useExploration } from './ExplorationContext'
import { explorationJournalEntries, explorationJournalNotes } from './explorationPresentation'

export function ExplorationJournal() {
  const exploration = useExploration()
  if (!exploration.active) return null
  const entries = explorationJournalEntries(exploration.projection), notes = explorationJournalNotes(exploration.projection)
  return <section className="exploration-journal" aria-labelledby="exploration-journal-title">
    <h2 id="exploration-journal-title">First Basin field record</h2>
    <p>{entries.filter(entry => entry.discoveredAt).length} / {entries.length} landmarks discovered</p>
    {!exploration.projection && <p role="status">{exploration.error || 'Loading field record…'}{exploration.error && <button className="cg-button" onClick={() => void exploration.refresh()}>Retry</button>}</p>}
    <div className="journal-grid">{entries.map(entry => <article className={`journal-entry ${entry.discoveredAt ? 'journal-entry--discovered' : 'journal-entry--unknown'}`} key={entry.id}>
      <span>{entry.discoveredAt ? 'Discovered' : 'Undiscovered'} · {entry.area}</span><h3>{entry.name}</h3><p>{entry.description}</p>
      {entry.discoveredAt && <time dateTime={entry.discoveredAt}>{new Date(entry.discoveredAt).toLocaleDateString()}</time>}
    </article>)}</div>
    <h3>Field notes</h3>
    {notes.length ? <div className="journal-grid">{notes.map(note => <article className="journal-entry" key={note.id}><span>{note.area}</span><h4>{note.name}</h4><p>{note.description}</p><time dateTime={note.discoveredAt}>{new Date(note.discoveredAt).toLocaleDateString()}</time></article>)}</div> : <p>Inspect trail markers and formations to record small observations.</p>}
  </section>
}
