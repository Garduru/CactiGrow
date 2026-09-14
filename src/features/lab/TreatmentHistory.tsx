import type { QuantitativeSeedTreatment } from '../../types/treatment'
import { extractTargetLabels } from './extractionModel'

export function TreatmentHistory({ treatments, compact = false }: { treatments?: QuantitativeSeedTreatment[]; compact?: boolean }) {
  if (!treatments?.length) return null
  return <section className={compact ? 'treatment-history treatment-history--compact' : 'treatment-history'} aria-label="Treatment history"><strong>Quantitative Treatment</strong>{treatments.map((treatment) => <dl key={treatment.id}><div><dt>Target</dt><dd>{extractTargetLabels[treatment.target]}</dd></div><div><dt>Source extract</dt><dd>{treatment.extractId}</dd></div><div><dt>Quality / potency</dt><dd>{treatment.extractionQualityBand} · {treatment.extractPotency}/100</dd></div><div><dt>Status</dt><dd>{treatment.status}</dd></div>{treatment.resolution && <><div><dt>Original</dt><dd>{treatment.resolution.originalValue}</dd></div><div><dt>Gain</dt><dd>+{treatment.resolution.gain}</dd></div><div><dt>Final</dt><dd>{treatment.resolution.finalValue}</dd></div></>}</dl>)}</section>
}
