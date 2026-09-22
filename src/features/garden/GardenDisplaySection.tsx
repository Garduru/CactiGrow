import { useId, useState, type ReactNode } from 'react'

export function GardenDisplaySection({ description, children }: { description: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const titleId = useId()

  return <section className="garden-display-summary" aria-labelledby={titleId}>
    <h2 id={titleId}>
      <button className="garden-display-summary__toggle" type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((current) => !current)}>
        <span>Display beds</span><span className="garden-display-summary__chevron" aria-hidden="true" />
      </button>
    </h2>
    <div id={contentId}>
      {expanded && <><p>{description}</p><div className="garden-display-summary__grid">{children}</div></>}
    </div>
  </section>
}
