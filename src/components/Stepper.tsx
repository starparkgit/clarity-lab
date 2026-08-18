import { STEP_LABELS, STEPS } from '../lib/sessions'
import type { SessionType } from '../types'

export function Stepper({
  type,
  current,
  onSelect,
}: {
  type: SessionType
  current: string
  onSelect: (step: string) => void
}) {
  const steps = STEPS[type].filter((s) => s !== 'done')
  return (
    <div className="stepper">
      {steps.map((step, i) => (
        <button
          key={step}
          className={step === current ? 'on' : ''}
          type="button"
          onClick={() => onSelect(step)}
        >
          {i + 1}. {STEP_LABELS[step]}
        </button>
      ))}
    </div>
  )
}
