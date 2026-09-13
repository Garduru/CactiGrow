interface ProgressBarProps {
  value: number
  max: number
  label?: string
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const safeMax = Math.max(max, 1)
  const percentage = Math.min(Math.max((value / safeMax) * 100, 0), 100)

  return (
    <div className="progress">
      <div className="progress__info">
        {label && <span>{label}</span>}
        <span>
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>

      <div
        className="progress__track"
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(Math.max(value, 0), safeMax)}
      >
        <div
          className="progress__fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
