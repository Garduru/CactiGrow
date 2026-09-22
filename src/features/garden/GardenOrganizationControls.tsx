import { useState, type FormEvent } from 'react'
import type { GardenSpecimenOrganization } from '../../types/garden'
import { MAX_GARDEN_TAG_LENGTH, MAX_GARDEN_TAGS_PER_SPECIMEN } from './gardenOrganizationModel'

interface GardenOrganizationControlsProps {
  metadata?: GardenSpecimenOrganization
  onFavoriteChange: (favorite: boolean) => void
  onAddTag: (tag: string) => boolean | Promise<boolean>
  onRemoveTag: (tag: string) => void
}

export function GardenOrganizationControls({ metadata, onFavoriteChange, onAddTag, onRemoveTag }: GardenOrganizationControlsProps) {
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')
  const tags = metadata?.tags ?? []

  async function submitTag(event: FormEvent) {
    event.preventDefault()
    if (await onAddTag(tag)) {
      setTag('')
      setError('')
    } else setError(`Use a unique 1–${MAX_GARDEN_TAG_LENGTH} character tag; up to ${MAX_GARDEN_TAGS_PER_SPECIMEN} per specimen.`)
  }

  return <section className="garden-organization" aria-labelledby="garden-organization-title">
    <div className="garden-organization__heading"><h3 id="garden-organization-title">Organized Beds</h3><button type="button" aria-pressed={metadata?.favorite ?? false} onClick={() => onFavoriteChange(!(metadata?.favorite ?? false))}>{metadata?.favorite ? '★ Favorite' : '☆ Add favorite'}</button></div>
    {tags.length > 0 && <ul className="garden-tags" aria-label="Specimen tags">{tags.map((entry) => <li key={entry}><span>{entry}</span><button type="button" onClick={() => onRemoveTag(entry)} aria-label={`Remove ${entry} tag`}>×</button></li>)}</ul>}
    <form className="garden-tag-form" onSubmit={submitTag}><label htmlFor="garden-new-tag">Add tag</label><div><input id="garden-new-tag" value={tag} maxLength={MAX_GARDEN_TAG_LENGTH + 1} onChange={(event) => setTag(event.target.value)} placeholder="Breeders, Keepers…" /><button type="submit">Add</button></div>{error && <small role="alert">{error}</small>}</form>
  </section>
}
