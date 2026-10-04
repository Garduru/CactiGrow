import { worldInputBoundary } from '../../components/layout/worldInputBoundary'
import { useSocialPanel } from './useSocialPanel'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { SocialPanelTab } from './socialPanelState'
import { ChatConversation } from './ChatConversation'
import { useChatViewport } from './useChatViewport'

type InGameChatMode = Exclude<SocialPanelTab, 'friends'>

interface InGameChatHudProps {
  mode: InGameChatMode
  onModeChange: (mode: InGameChatMode) => void
}

export function InGameChatHud({ mode, onModeChange }: InGameChatHudProps) {
  const { setChatDockExpanded } = useSocialPanel()
  const viewportRef = useChatViewport(true)
  function containTyping(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') event.stopPropagation()
  }

  function selectMode(event: MouseEvent<HTMLButtonElement>, nextMode: InGameChatMode) {
    onModeChange(nextMode)
    if (event.detail > 0) event.currentTarget.blur()
  }

  return (
    <section {...worldInputBoundary} ref={viewportRef} id="world-chat-hud" className="world-chat-hud" aria-label="In-game Chat" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()} onKeyDown={containTyping} onKeyUp={containTyping}>
      <nav className="world-chat-hud__tabs" aria-label="Chat modes">
        <button type="button" aria-current={mode === 'local-chat' ? 'page' : undefined} onClick={(event) => selectMode(event, 'local-chat')}>Local</button>
        <button type="button" aria-current={mode === 'town-chat' ? 'page' : undefined} onClick={(event) => selectMode(event, 'town-chat')}>Town</button>
        <button type="button" aria-current={mode === 'world-chat' ? 'page' : undefined} onClick={(event) => selectMode(event, 'world-chat')}>World</button>
        <button type="button" aria-current={mode === 'messages' ? 'page' : undefined} onClick={(event) => selectMode(event, 'messages')}>DMs</button>
        <button type="button" onClick={() => setChatDockExpanded(false)} aria-label="Close chat">Close</button>
      </nav>
      <ChatConversation mode={mode} compact />
    </section>
  )
}
