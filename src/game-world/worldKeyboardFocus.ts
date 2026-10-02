export function isEditableElement(element: Element | null): boolean {
  return !!element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
}

export function canUseWorldKeyboard(canvas: HTMLElement): boolean {
  const document = canvas.ownerDocument
  const active = document.activeElement
  return !isEditableElement(active)
    && !document.querySelector('[role="dialog"][aria-modal="true"]')
    && (active === document.body || active === canvas)
}

interface WorldKeyboard {
  enabled: boolean
  manager: { enabled: boolean }
  resetKeys(): unknown
}

// Disable Phaser's DOM capture before its window listener can prevent typing.
// Reset held keys on focus transfer so they cannot resume after closing UI.
export function bindWorldKeyboardFocus(canvas: HTMLElement, keyboard: WorldKeyboard): () => void {
  const document = canvas.ownerDocument
  const sync = () => {
    const enabled = canUseWorldKeyboard(canvas)
    keyboard.enabled = enabled
    keyboard.manager.enabled = enabled
    if (!enabled) keyboard.resetKeys()
  }
  document.addEventListener('focusin', sync)
  document.addEventListener('keydown', sync, true)
  document.addEventListener('keyup', sync, true)
  sync()
  return () => {
    document.removeEventListener('focusin', sync)
    document.removeEventListener('keydown', sync, true)
    document.removeEventListener('keyup', sync, true)
  }
}
