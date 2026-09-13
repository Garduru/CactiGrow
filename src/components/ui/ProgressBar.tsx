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

      <div className="progress__track">
        <div
          className="progress__fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}