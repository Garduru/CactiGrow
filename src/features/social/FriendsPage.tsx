import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'

type FriendCategory = 'online' | 'offline' | 'requests'

const categories: readonly { id: FriendCategory; label: string; emptyTitle: string; emptyCopy: string }[] = [
  { id: 'online', label: 'Online', emptyTitle: 'No friends online', emptyCopy: 'Online friends will appear here when social services are connected.' },
  { id: 'offline', label: 'Offline', emptyTitle: 'No offline friends', emptyCopy: 'Offline friends will appear here when social services are connected.' },
  { id: 'requests', label: 'Requests', emptyTitle: 'No pending requests', emptyCopy: 'Incoming and outgoing friend requests will appear here.' },
]

export function FriendsPage() {
  const [category, setCategory] = useState<FriendCategory>('online')
  const activeCategory = categories.find((item) => item.id === category)!

  return <section className="social-page" aria-labelledby="friends-title">
    <LocationHeader
      eyebrow="Social"
      title="Friends"
      titleId="friends-title"
      subtitle="Manage relationships and future Farm visits from one place."
      actions={<Button disabled title="Player identity services are not connected">Add Friend</Button>}
    />
    <nav className="social-switcher" aria-label="Friend categories">
      {categories.map((item) => <button key={item.id} type="button" aria-current={category === item.id ? 'page' : undefined} className={category === item.id ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </nav>
    <section className="friends-list" aria-labelledby="friends-category-title">
      <h2 id="friends-category-title">{activeCategory.label}</h2>
      <EmptyState title={activeCategory.emptyTitle}>{activeCategory.emptyCopy}</EmptyState>
    </section>
    <p className="social-future-note">Future friend actions will include Message, Visit Farm, View Profile, and relationship management. Visit Farm will require an authoritative access check before entering the friend’s Farm arrival area.</p>
  </section>
}
