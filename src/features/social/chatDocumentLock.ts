import { finishAdminViewportRestoration } from '../admin/adminViewportRestoration'

let stopRestoration: (() => void) | undefined

/** The proven Admin viewport approach, activated only while a mobile chat field has focus. */
export function lockChatDocument(): () => void {
  stopRestoration?.()
  stopRestoration = undefined
  const body = document.body, root = document.documentElement
  const x = window.scrollX, y = window.scrollY
  const savedBody = ['position', 'top', 'left', 'width', 'overflow', 'overscroll-behavior'].map(k => [k, body.style.getPropertyValue(k), body.style.getPropertyPriority(k)])
  const savedRoot = ['overflow', 'overscroll-behavior', 'scroll-behavior'].map(k => [k, root.style.getPropertyValue(k), root.style.getPropertyPriority(k)])
  body.style.position = 'fixed'; body.style.top = `${-y}px`; body.style.left = `${-x}px`; body.style.width = '100%'; body.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none'
  root.style.overflow = 'hidden'; root.style.overscrollBehavior = 'none'; root.style.scrollBehavior = 'auto'
  return () => {
    for (const [k, v, p] of savedBody) body.style.setProperty(k, v, p)
    for (const [k, v, p] of savedRoot) root.style.setProperty(k, v, p)
    const restore = () => { const behavior = root.style.scrollBehavior; root.style.scrollBehavior = 'auto'; window.scrollTo(x, y); root.style.scrollBehavior = behavior }
    restore(); stopRestoration = finishAdminViewportRestoration(restore)
  }
}
