import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'

export function MailPage() {
  return (
    <section aria-labelledby="mail-title">
      <LocationHeader titleId="mail-title" eyebrow="Farm mailbox" title="Mailbox" subtitle="Persistent player mail will be available here." />
      <EmptyState title="The mailbox is empty">
        Inbox, composing, delivery, history, and attachments are not implemented.
      </EmptyState>
    </section>
  )
}
