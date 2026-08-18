import { useEffect, useState } from 'react'
import { formatMmSs } from '../lib/time'

export function TimerBar({
  startedAt,
  durationMs,
  label,
}: {
  startedAt: number
  durationMs: number
  label: string
}) {
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = nowTs - startedAt
  const remaining = Math.max(0, durationMs - elapsed)
  const overtime = Math.max(0, elapsed - durationMs)
  const expired = overtime > 0
  return (
    <div className={`timer${expired ? ' over' : ''}`}>
      <span>{label}</span>
      <strong>
        {expired ? `시간 종료 · 초과 ${formatMmSs(overtime)}` : formatMmSs(remaining)}
      </strong>
    </div>
  )
}
