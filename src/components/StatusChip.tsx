import type { NetworkChip } from '../types'

const LABELS: Record<NetworkChip, string> = {
  online: '온라인',
  offline: '오프라인',
  syncing: '동기화 중',
  queued: '동기화 대기',
}

export function StatusChip({ chip }: { chip: NetworkChip }) {
  return (
    <span className={`chip ${chip}`}>
      <span className="dot" />
      {LABELS[chip]}
    </span>
  )
}
