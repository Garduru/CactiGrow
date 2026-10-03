import { getSpeciesById } from '../../data/species'
import { DEFAULT_COLLECTION_FILTERS, type CollectionFilters, type CollectionSort } from './collectionManagement'

export function CollectionTools({ filters, sort, speciesIds, count, total, onFilters, onSort }: { filters: CollectionFilters; sort: CollectionSort; speciesIds: string[]; count: number; total: number; onFilters: (filters: CollectionFilters) => void; onSort: (sort: CollectionSort) => void }) {
  return <div className="garden-tools collection-tools" aria-label="Collection filters">
    <div className="collection-tools__tabs" role="group" aria-label="Quick filters">
      <button type="button" aria-pressed={JSON.stringify(filters) === JSON.stringify(DEFAULT_COLLECTION_FILTERS)} onClick={() => onFilters(DEFAULT_COLLECTION_FILTERS)}>All</button>
      <button type="button" aria-pressed={filters.favorite} onClick={() => onFilters({ ...filters, favorite: !filters.favorite })}>★ Favorites</button>
      <button type="button" aria-pressed={filters.research === 'unresearched'} onClick={() => onFilters({ ...filters, research: filters.research === 'unresearched' ? 'all' : 'unresearched' })}>Unresearched</button>
      <span role="status">{count} of {total}</span>
    </div>
    <div className="garden-tools__panel">
      <label>Search<input type="search" value={filters.search} placeholder="Species, specimen or tag" onChange={(e) => onFilters({ ...filters, search: e.target.value })} /></label>
      <label>Species<select value={filters.species} onChange={(e) => onFilters({ ...filters, species: e.target.value })}><option value="">All species</option>{speciesIds.map((id) => <option key={id} value={id}>{getSpeciesById(id)?.commonName ?? id}</option>)}</select></label>
      <label>Research<select value={filters.research} onChange={(e) => onFilters({ ...filters, research: e.target.value as CollectionFilters['research'] })}><option value="all">All research states</option><option value="unresearched">Unresearched</option><option value="researched">Studied (any depth)</option><option value="available">Research available</option><option value="complete">Research complete</option></select></label>
      <label>Listing<select value={filters.listing} onChange={(e) => onFilters({ ...filters, listing: e.target.value as CollectionFilters['listing'] })}><option value="all">Listed and unlisted</option><option value="listed">Listed</option><option value="unlisted">Unlisted</option></select></label>
      <label>Sort<select value={sort} onChange={(e) => onSort(e.target.value as CollectionSort)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Species / name</option><option value="favorites">Favorites first</option><option value="clone-line">Clone line</option></select></label>
      <label className="garden-tools__favorite"><input type="checkbox" checked={filters.breeding} onChange={(e) => onFilters({ ...filters, breeding: e.target.checked })} />Eligible to breed</label>
      <button type="button" onClick={() => { onFilters(DEFAULT_COLLECTION_FILTERS); onSort('newest') }}>Reset</button>
    </div>
  </div>
}
