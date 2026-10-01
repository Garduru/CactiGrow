import { useState } from 'react'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { ChatConversation } from './ChatConversation'

type ChatMode = 'world-chat' | 'messages'

export function ChatPage({ selectedMode }: { selectedMode?: ChatMode }) {
  const [mode, setMode] = useState<ChatMode>('world-chat')
  const activeMode = selectedMode ?? mode

  return <section className="social-page chat-page" aria-labelledby="chat-title">
    <LocationHeader eyebrow="Social" title="Chat" titleId="chat-title" subtitle="Town World Chat and live Direct Messages." />
    {!selectedMode && <nav className="social-switcher social-switcher--chat" aria-label="Chat modes">
      <button type="button" aria-current={mode === 'world-chat' ? 'page' : undefined} className={mode === 'world-chat' ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setMode('world-chat')}>World</button>
      <button type="button" aria-current={mode === 'messages' ? 'page' : undefined} className={mode === 'messages' ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setMode('messages')}>Direct Messages</button>
    </nav>}
    <ChatConversation mode={activeMode} />
  </section>
}
