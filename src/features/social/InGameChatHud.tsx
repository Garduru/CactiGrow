import type { KeyboardEvent, MouseEvent } from 'react'
import type { SocialPanelTab } from './socialPanelState'

type InGameChatMode = Extract<SocialPanelTab, 'messages' | 'world-chat'>

interface InGameChatHudProps {
  mode: InGameChatMode
  onModeChange: (mode: InGameChatMode) => void
}

const chatPresentation = {
  'world-chat': {
    emptyTitle: 'World Chat is not connected',
    emptyBody: 'World conversation will appear here when multiplayer services are available.',
    inputHint: 'World Chat is unavailable',
  },
  messages: {
    emptyTitle: 'No conversation selected',
    emptyBody: 'Direct Message conversations with online friends will appear here.',
    inputHint: 'Select an online friend',
  },
} as const

export function InGameChatHud({ mode, onModeChange }: InGameChatHudProps) {
  const presentation = chatPresentation[mode]

  function containTyping(event: KeyboardEvent<HTMLElement>) {
    event.stopPropagation()
    if (event.key === 'Escape' && event.target instanceof HTMLElement) event.target.blur()
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
      <div className="world-chat-hud__history" role="log" aria-live="polite" aria-label={mode === 'world-chat' ? 'World Chat messages' : 'Direct Messages'}>
        <p><strong>{presentation.emptyTitle}</strong><span>{presentation.emptyBody}</span></p>
      </div>
      <form className="world-chat-hud__composer" aria-label="Chat message composer" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="world-chat-message">Message</label>
        <input id="world-chat-message" type="text" disabled placeholder={presentation.inputHint} />
        <button type="submit" disabled>Send</button>
      </form>
    </section>
  )
}
