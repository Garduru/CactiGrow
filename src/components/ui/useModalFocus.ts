import { useEffect, type RefObject } from 'react'

/** Keep keyboard focus in a modal, including its non-interactive busy state. */
export function useModalFocus(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
  busy = false,
  phase = '',
) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])

  useEffect(() => {
    const root = panel.current
    if (!root) return
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
    ))
    if (!root.contains(document.activeElement)) (controls()[0] ?? root).focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busy) onClose()
      }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0] ?? root!
      const last = items[items.length - 1] ?? root!
      if (!root!.contains(document.activeElement) || document.activeElement === root || !items.length) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [panel, onClose, busy, phase])
}
