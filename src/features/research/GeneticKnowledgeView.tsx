import type { GeneticKnowledgeProjection } from './researchModel'

const quantitativeLabels = {
  vigor: 'Vigor',
  growthSpeed: 'Growth speed',
  size: 'Size',
  flowering: 'Flowering',
  mutationChance: 'Mutation tendency',
} as const

export function GeneticKnowledgeView({ knowledge }: { knowledge: GeneticKnowledgeProjection }) {
  return (
    <div className="research-knowledge">
      <dl className="research-identity">
        <div><dt>Clone line</dt><dd>{knowledge.cloneLineId}</dd></div>
        <div><dt>Research depth</dt><dd>{knowledge.depthLabel}</dd></div>
        {knowledge.shiny !== null && <div><dt>Special variant</dt><dd>{knowledge.shiny ? 'Shiny' : 'Normal'}</dd></div>}
        {knowledge.hybrid !== null && <div><dt>Origin</dt><dd>{knowledge.hybrid ? 'Same-genus hybrid' : 'Non-hybrid'}</dd></div>}
      </dl>

      {knowledge.quantitativeGenetics && (
        <section className="research-knowledge__section" aria-labelledby={`quantitative-${knowledge.cloneLineId}`}>
          <h3 id={`quantitative-${knowledge.cloneLineId}`}>Observed quantitative genetics</h3>
          <dl className="research-quantitative">
            {Object.entries(quantitativeLabels).map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{knowledge.quantitativeGenetics![key as keyof typeof quantitativeLabels]}</dd></div>
            ))}
          </dl>
          {knowledge.quantitativeInterpretation && <p>Improved interpretation active. Mutation Tendency remains a rating, not a percentage.</p>}
        </section>
      )}

      <section className="research-knowledge__section" aria-labelledby={`features-${knowledge.cloneLineId}`}>
        <h3 id={`features-${knowledge.cloneLineId}`}>Known visible features</h3>
        {knowledge.visibleFeatures.length ? (
          <ul className="research-feature-list">
            {knowledge.visibleFeatures.map((feature) => (
              <li key={feature.name}>
                <strong>{feature.name}</strong>
                {feature.classification && <span>{feature.classification}</span>}
                {feature.expressionStrength !== undefined && <span>Expression {feature.expressionStrength}%</span>}
                {feature.stability && <span>Stability: {feature.stability}</span>}
                {feature.inheritanceEstimate && <span>CactiGrow breeding estimate: {feature.inheritanceEstimate}</span>}
              </li>
            ))}
          </ul>
        ) : <p>No visible genetic features recorded.</p>}
      </section>

      {knowledge.carrierFeatures.length > 0 && (
        <section className="research-knowledge__section" aria-labelledby={`carriers-${knowledge.cloneLineId}`}>
          <h3 id={`carriers-${knowledge.cloneLineId}`}>Detected hidden carriers</h3>
          <ul className="research-feature-list">
            {knowledge.carrierFeatures.map((feature) => <li key={feature.name}><strong>{feature.name}</strong><span>Non-expressed carrier</span></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
