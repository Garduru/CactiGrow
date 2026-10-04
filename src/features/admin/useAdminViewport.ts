import { useEffect, useRef } from 'react'
import { finishAdminViewportRestoration } from './adminViewportRestoration'

/** Admin forms scroll inside the overlay, never by moving the game document. */
export function useAdminViewport(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const cancelRestoration = useRef<(() => void) | null>(null)
  useEffect(() => {
    const overlay = ref.current
    if (!active || !overlay) return
    cancelRestoration.current?.()
    cancelRestoration.current = null
    const viewport = window.visualViewport
    const scrollX = window.scrollX, scrollY = window.scrollY
    const body = document.body, root = document.documentElement
    const savedBody = ['position', 'top', 'left', 'width', 'overflow', 'overscroll-behavior'].map(key => [key, body.style.getPropertyValue(key), body.style.getPropertyPriority(key)])
    const savedRoot = ['overflow', 'overscroll-behavior', 'scroll-behavior'].map(key => [key, root.style.getPropertyValue(key), root.style.getPropertyPriority(key)])
    const savedViewport = ['--admin-viewport-top', '--admin-viewport-left', '--admin-viewport-width', '--admin-viewport-height', '--admin-hud-space'].map(key => [key, overlay.style.getPropertyValue(key), overlay.style.getPropertyPriority(key)])
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
      const focused = document.activeElement
      if (focused instanceof HTMLElement && overlay.contains(focused)) focused.blur()
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      overlay.removeEventListener('focusin', update)
      window.cancelAnimationFrame(frame)
      for (const [key, value, priority] of savedViewport) overlay.style.setProperty(key, value, priority)
      for (const [key, value, priority] of savedBody) body.style.setProperty(key, value, priority)
      // Restore the original document position without a CSS smooth-scroll animation.
      for (const [key, value, priority] of savedRoot) if (key !== 'scroll-behavior') root.style.setProperty(key, value, priority)
      const [, behavior, priority] = savedRoot.find(([key]) => key === 'scroll-behavior')!
      const restoreScroll = () => {
        root.style.setProperty('scroll-behavior', 'auto')
        window.scrollTo(scrollX, scrollY)
        root.style.setProperty('scroll-behavior', behavior, priority)
      }
      restoreScroll()
      cancelRestoration.current = finishAdminViewportRestoration(restoreScroll)
    }
  }, [active])
  useEffect(() => () => cancelRestoration.current?.(), [])
  return ref
}
