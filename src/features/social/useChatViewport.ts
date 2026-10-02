import { useEffect, useRef } from 'react'

/** Keep chat inside the visual viewport when a mobile keyboard resizes or pans it. */
export function useChatViewport<T extends HTMLElement = HTMLElement>(anchored: boolean, active = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!active || !element) return
    const viewport = window.visualViewport
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
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [anchored, active])
  return ref
}
