import { useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { ChatShell } from './ChatShell'

type ChatMode = 'world' | 'direct'

export function ChatPage() {
  const [mode, setMode] = useState<ChatMode>('world')

  return <section className="social-page chat-page" aria-labelledby="chat-title">
    <LocationHeader eyebrow="Social" title="Chat" titleId="chat-title" subtitle="Live conversations will appear here when multiplayer services are connected." />
    <nav className="social-switcher social-switcher--chat" aria-label="Chat modes">
      <button type="button" aria-current={mode === 'world' ? 'page' : undefined} className={mode === 'world' ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setMode('world')}>World</button>
      <button type="button" aria-current={mode === 'direct' ? 'page' : undefined} className={mode === 'direct' ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setMode('direct')}>Direct Messages</button>
    </nav>
    {mode === 'world' ? <>
      <ChatShell label="World Chat" composerHint="World Chat is unavailable" emptyState={<EmptyState compact title="World Chat is not connected">World Chat becomes available in connected multiplayer areas such as Town.</EmptyState>} />
      <p className="social-future-note">World Chat will be location and instance aware. Local messages may briefly appear above avatars while React retains conversation context and history.</p>
    </> : <>
      <ChatShell
        label="Direct Messages"
        composerHint="Select an online friend"
        sidebar={<EmptyState compact title="No conversations">Direct Message conversations will appear here.</EmptyState>}
        emptyState={<EmptyState compact title="No conversation selected">Choose an online friend to begin a live private conversation.</EmptyState>}
      />
      <p className="social-future-note">Direct Messages require both players to be online. An offline Direct Message will not become Mail; persistent messages remain a separate Mailbox system.</p>
    </>}
  </section>
}
