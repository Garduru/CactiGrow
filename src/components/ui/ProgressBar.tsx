interface ProgressBarProps {
  value: number
  max: number
  label?: string
  displayValue?: string
  ariaLabel?: string
  ariaValueText?: string
}

export function ProgressBar({ value, max, label, displayValue, ariaLabel, ariaValueText }: ProgressBarProps) {
  const safeMax = Math.max(max, 1)
  const percentage = Math.min(Math.max((value / safeMax) * 100, 0), 100)

  return (
    <div className="progress">
      <div className="progress__info">
        {label && <span>{label}</span>}
        <span>
          {displayValue ?? `${value.toLocaleString()} / ${max.toLocaleString()}`}
        </span>
      </div>

      <div
        className="progress__track"
        role="progressbar"
        aria-label={ariaLabel ?? label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(Math.max(value, 0), safeMax)}
        aria-valuetext={ariaValueText}
      >
        <div
          className="progress__fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
