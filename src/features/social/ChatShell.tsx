import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'

interface ChatShellProps {
  label: string
  emptyState: ReactNode
  sidebar?: ReactNode
  composerHint: string
}

export function ChatShell({ label, emptyState, sidebar, composerHint }: ChatShellProps) {
  return <section className={sidebar ? 'chat-shell chat-shell--with-sidebar' : 'chat-shell'} aria-label={label}>
    {sidebar && <aside className="chat-shell__sidebar" aria-label="Conversations">{sidebar}</aside>}
    <div className="chat-shell__conversation">
      <div className="chat-shell__messages" aria-live="polite">{emptyState}</div>
      <form className="chat-composer" aria-label={`${label} message composer`} onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor={`chat-composer-${label.replaceAll(' ', '-').toLowerCase()}`}>Message</label>
        <input id={`chat-composer-${label.replaceAll(' ', '-').toLowerCase()}`} type="text" disabled placeholder={composerHint} />
        <Button disabled variant="primary">Send</Button>
      </form>
    </div>
  </section>
}
