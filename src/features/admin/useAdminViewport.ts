import { useEffect, useRef } from 'react'

/** Admin forms scroll inside the overlay, never by moving the game document. */
export function useAdminViewport(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const overlay = ref.current
    if (!active || !overlay) return
    const viewport = window.visualViewport
    const scrollX = window.scrollX, scrollY = window.scrollY
    const body = document.body, root = document.documentElement
    const savedBody = ['position', 'top', 'left', 'width', 'overflow', 'overscroll-behavior'].map(key => [key, body.style.getPropertyValue(key), body.style.getPropertyPriority(key)])
    const savedRoot = ['overflow', 'overscroll-behavior', 'scroll-behavior'].map(key => [key, root.style.getPropertyValue(key), root.style.getPropertyPriority(key)])
    body.style.position = 'fixed'
    body.style.top = `${-scrollY}px`
    body.style.left = `${-scrollX}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    root.style.scrollBehavior = 'auto'
    let frame = 0
    const keepFocusVisible = () => {
      const content = overlay.querySelector<HTMLElement>('.feature-panel__content')
      const focused = document.activeElement
      if (!content || !(focused instanceof HTMLElement) || !content.contains(focused)) return
      const bounds = content.getBoundingClientRect(), field = focused.getBoundingClientRect()
      if (field.bottom > bounds.bottom) content.scrollTop += field.bottom - bounds.bottom + 12
      else if (field.top < bounds.top) content.scrollTop -= bounds.top - field.top + 12
    }
    const update = () => {
      const height = viewport?.height ?? window.innerHeight
      overlay.style.setProperty('--admin-viewport-top', `${viewport?.offsetTop ?? 0}px`)
      overlay.style.setProperty('--admin-viewport-left', `${viewport?.offsetLeft ?? 0}px`)
      overlay.style.setProperty('--admin-viewport-width', `${viewport?.width ?? window.innerWidth}px`)
      overlay.style.setProperty('--admin-viewport-height', `${height}px`)
      overlay.style.setProperty('--admin-hud-space', height >= 400 ? '72px' : '12px')
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(keepFocusVisible)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    overlay.addEventListener('focusin', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      overlay.removeEventListener('focusin', update)
      window.cancelAnimationFrame(frame)
      for (const [key, value, priority] of savedBody) body.style.setProperty(key, value, priority)
      // Restore the original document position without a CSS smooth-scroll animation.
      for (const [key, value, priority] of savedRoot) if (key !== 'scroll-behavior') root.style.setProperty(key, value, priority)
      window.scrollTo(scrollX, scrollY)
      const [, behavior, priority] = savedRoot.find(([key]) => key === 'scroll-behavior')!
      root.style.setProperty('scroll-behavior', behavior, priority)
    }
  }, [active])
  return ref
}
