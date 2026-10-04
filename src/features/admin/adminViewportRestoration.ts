/** Finish document restoration after mobile keyboard/focus viewport events settle. */
export function finishAdminViewportRestoration(restoreScroll: () => void): () => void {
  const viewport = window.visualViewport
  let frame = 0, stopped = false
  let settleTimer = 0
  const stop = () => {
    stopped = true
    window.cancelAnimationFrame(frame)
    window.clearTimeout(settleTimer)
    window.clearTimeout(deadline)
    viewport?.removeEventListener('resize', update)
    viewport?.removeEventListener('scroll', update)
  }
  const finish = () => {
    if (stopped) return
    stop()
    restoreScroll()
    // Existing game ScaleManager owns sizing/camera; notify it after normal DOM layout returns.
    window.dispatchEvent(new Event('resize'))
  }
  const update = () => {
    window.cancelAnimationFrame(frame)
    window.clearTimeout(settleTimer)
    frame = window.requestAnimationFrame(() => {
      if (stopped) return
      restoreScroll()
    })
    // A timer also covers delayed animation frames during keyboard compositor transitions.
    // Keep listening while the keyboard is still collapsing; never impose a viewport scale.
    settleTimer = window.setTimeout(() => {
      if (!viewport || viewport.height >= window.innerHeight - 1) finish()
    }, 100)
  }
  const deadline = window.setTimeout(finish, 600)
  viewport?.addEventListener('resize', update)
  viewport?.addEventListener('scroll', update)
  update()
  return stop
}
