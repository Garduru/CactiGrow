import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export function UtilityMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function dismissEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [open])

  return (
    <div className="utility-menu" ref={containerRef}>
      {open && (
        <div className="utility-menu__panel" id="utility-panel" role="group" aria-label="Utilities">
          <Link to="/achievements" onClick={() => setOpen(false)}>Achievements</Link>
          {['Grow Log', 'Settings', 'Help', 'CactiSwap'].map((item) => (
            <button key={item} type="button" aria-disabled="true" title="Coming soon">{item}</button>
          ))}
        </div>
      )}

      <button
        className="utility-menu__toggle"
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? 'utility-panel' : undefined}
        aria-label={`${open ? 'Close' : 'Open'} CactiGrow menu`}
      >
        <span aria-hidden="true">{open ? '×' : '☰'}</span>
      </button>
    </div>
  )
}
