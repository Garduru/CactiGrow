import type { KeyboardEvent, MouseEvent } from 'react'
import type { SocialPanelTab } from './socialPanelState'
import { ChatConversation } from './ChatConversation'

type InGameChatMode = Extract<SocialPanelTab, 'messages' | 'world-chat'>

interface InGameChatHudProps {
  mode: InGameChatMode
  onModeChange: (mode: InGameChatMode) => void
}

export function InGameChatHud({ mode, onModeChange }: InGameChatHudProps) {
  function containTyping(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') event.stopPropagation()
  }

  function selectMode(event: MouseEvent<HTMLButtonElement>, nextMode: InGameChatMode) {
    onModeChange(nextMode)
    if (event.detail > 0) event.currentTarget.blur()
  }

  return (
    <section id="world-chat-hud" className="world-chat-hud" aria-label="In-game Chat" onKeyDown={containTyping} onKeyUp={containTyping}>
      <nav className="world-chat-hud__tabs" aria-label="Chat modes">
        <button type="button" aria-current={mode === 'world-chat' ? 'page' : undefined} onClick={(event) => selectMode(event, 'world-chat')}>World</button>
        <button type="button" aria-current={mode === 'messages' ? 'page' : undefined} onClick={(event) => selectMode(event, 'messages')}>DMs</button>
      </nav>
      <ChatConversation mode={mode} compact />
    </section>
  )
}
