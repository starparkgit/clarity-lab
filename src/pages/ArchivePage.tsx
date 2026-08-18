import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { db } from '../lib/db'
import { typeLabel } from '../lib/sessions'
import { formatKoreanDate } from '../lib/time'
import type { LocalSession, SessionStatus, SessionType } from '../types'

const TYPES: { id: 'all' | SessionType; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'explanation', label: '설명' },
  { id: 'argument', label: '논쟁' },
  { id: 'debate', label: '토론' },
]

function statusLabel(s: SessionStatus, sync: LocalSession['syncState']): string {
  const base =
    s === 'in_progress' ? '작성 중' : s === 'revision_pending' ? '고쳐쓰기 대기' : '완료'
  if (sync === 'pending' || sync === 'error') return `${base} · 동기화 대기`
  return base
}

export function ArchivePage() {
  const { profile } = useApp()
  const [rows, setRows] = useState<LocalSession[]>([])
  const [type, setType] = useState<'all' | SessionType>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!profile) return
    void db.sessions
      .where('profileId')
      .equals(profile.id)
      .toArray()
      .then((list) => setRows(list.sort((a, b) => b.updatedAt - a.updatedAt)))
  }, [profile])

  const filtered = rows.filter((s) => {
    if (type !== 'all' && s.type !== type) return false
    if (q && !s.topic.title.includes(q) && !s.topic.claim?.includes(q)) return false
    return true
  })

  return (
    <div className="stack">
      <h1 className="topic-title">기록</h1>
      <div className="row">
        {TYPES.map((t) => (
          <button key={t.id} className={`btn${type === t.id ? ' primary' : ''}`} type="button" onClick={() => setType(t.id)}>
            {t.label}
          </button>
        ))}
        <input type="text" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      {filtered.length === 0 && <p className="muted">해당하는 기록이 없습니다.</p>}
      <div className="list">
        {filtered.map((s) => (
          <Link key={s.id} to={`/archive/${s.id}`}>
            {typeLabel(s.type)} · {s.topic.title}
            <div className="muted">
              {statusLabel(s.status, s.syncState)} · {formatKoreanDate(s.updatedAt)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
