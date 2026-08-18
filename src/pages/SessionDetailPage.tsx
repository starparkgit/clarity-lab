import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { applyMarks } from '../lib/marks'
import { typeLabel } from '../lib/sessions'
import { formatKoreanDate, formatMmSs } from '../lib/time'
import type { LocalDocument, LocalSession } from '../types'

export function SessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<LocalSession | null>(null)
  const [docs, setDocs] = useState<LocalDocument[]>([])

  useEffect(() => {
    if (!id) return
    void db.sessions.get(id).then((s) => setSession(s ?? null))
    void db.documents.where('sessionId').equals(id).toArray().then(setDocs)
  }, [id])

  if (!session) return <p>기록을 찾지 못했습니다.</p>

  const ordered = docs.slice().sort((a, b) => a.version - b.version || a.createdAt - b.createdAt)
  const continueTo =
    session.status === 'in_progress'
      ? `/practice/${session.type}/${session.id}`
      : `/archive/${session.id}`

  return (
    <div className="stack">
      <p className="topic-kicker">{typeLabel(session.type)}</p>
      <h1 className="topic-title">{session.topic.title}</h1>
      <p className="muted">{formatKoreanDate(session.createdAt)} 시작 · 언어 {session.language === 'ko' ? '한국어' : 'English'}</p>
      <div className="row">
        {session.status === 'in_progress' && (
          <Link className="btn primary" to={continueTo}>
            이어쓰기
          </Link>
        )}
        <button
          className="btn danger"
          type="button"
          onClick={async () => {
            if (!window.confirm('이 세션을 삭제할까요?')) return
            await db.documents.where('sessionId').equals(session.id).delete()
            await db.sessions.delete(session.id)
            navigate('/archive')
          }}
        >
          삭제
        </button>
      </div>
      <div className="card">
        <h3>시간</h3>
        {Object.entries(session.durations).map(([step, ms]) => (
          <div key={step}>
            {step}: {formatMmSs(ms)}
          </div>
        ))}
      </div>
      {ordered.map((doc) => (
        <article key={doc.id} className="card stack">
          <strong>
            {doc.role} · v{doc.version}
          </strong>
          <div className="mark-surface" style={{ minHeight: 80 }}>
            {doc.role === 'annotated' && doc.marks
              ? applyMarks(doc.text, doc.marks)
              : doc.text || '(비어 있음)'}
          </div>
        </article>
      ))}
    </div>
  )
}
