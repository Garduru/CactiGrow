import { useEffect, useRef } from 'react'
import { lockChatDocument } from './chatDocumentLock'

/** Keep chat inside the visual viewport when a mobile keyboard resizes or pans it. */
export function useChatViewport<T extends HTMLElement = HTMLElement>(anchored: boolean, active = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!active || !element) return
    const viewport = window.visualViewport
    const saved = ['--chat-viewport-top', '--chat-viewport-height', '--chat-keyboard-inset'].map(k => [k, element.style.getPropertyValue(k), element.style.getPropertyPriority(k)])
    let unlock: (() => void) | undefined
    const focus = () => {
      if (anchored && window.matchMedia('(max-width: 620px), (pointer: coarse)').matches && !unlock) unlock = lockChatDocument()
    }
    const blur = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return
      unlock?.(); unlock = undefined
    }
    element.addEventListener('focusin', focus)
    element.addEventListener('focusout', blur)
    const update = () => {
      const top = viewport?.offsetTop ?? 0
      const height = viewport?.height ?? window.innerHeight
      const parent = element.parentElement?.getBoundingClientRect()
      const bottomInset = anchored && parent ? Math.max(0, parent.bottom - top - height) : 0
      const availableHeight = anchored && parent ? Math.max(0, Math.min(parent.bottom, top + height) - Math.max(parent.top, top)) : height
      element.style.setProperty('--chat-viewport-top', `${top}px`)
      element.style.setProperty('--chat-viewport-height', `${availableHeight}px`)
      element.style.setProperty('--chat-keyboard-inset', `${bottomInset}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    if (element.parentElement) observer.observe(element.parentElement)
    return () => {
      element.removeEventListener('focusin', focus)
      element.removeEventListener('focusout', blur)
      const focused = document.activeElement
      if (focused instanceof HTMLElement && element.contains(focused)) focused.blur()
      unlock?.()
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
      for (const [k, v, p] of saved) element.style.setProperty(k, v, p)
    }
  }, [anchored, active])
  return ref
}
