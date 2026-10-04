import { useState } from 'react'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { ChatConversation } from './ChatConversation'

type ChatMode = 'world-chat' | 'messages' | 'local-chat' | 'town-chat'

export function ChatPage({ selectedMode }: { selectedMode?: ChatMode }) {
  const [mode, setMode] = useState<ChatMode>('world-chat')
  const activeMode = selectedMode ?? mode

  return <section className="social-page chat-page" aria-labelledby="chat-title">
    <LocationHeader eyebrow="Social" title="Chat" titleId="chat-title" subtitle="Local, Town, Zone-wide World chat and live Direct Messages." />
    {!selectedMode && <nav className="social-switcher social-switcher--chat" aria-label="Chat modes">
      {(['local-chat', 'town-chat', 'world-chat', 'messages'] as const).map(channel => <button key={channel} type="button" aria-current={mode === channel ? 'page' : undefined} className={mode === channel ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setMode(channel)}>{channel === 'messages' ? 'DM' : channel === 'local-chat' ? 'Local' : channel === 'town-chat' ? 'Town' : 'World'}</button>)}
    </nav>}
    <ChatConversation mode={activeMode} />
  </section>
}
