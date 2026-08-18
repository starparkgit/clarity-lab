import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { db } from '../lib/db'
import { startRevision, typeLabel } from '../lib/sessions'
import { formatKoreanDate } from '../lib/time'
import type { LocalSession } from '../types'

export function RevisionsPage() {
  const { profile } = useApp()
  const navigate = useNavigate()
  const [rows, setRows] = useState<LocalSession[]>([])

  useEffect(() => {
    if (!profile) return
    void db.sessions
      .where('profileId')
      .equals(profile.id)
      .toArray()
      .then(setRows)
  }, [profile])

  const nowTs = Date.now()
  const due = rows.filter((s) => s.dueRevisions.some((r) => !r.done && r.at <= nowTs))
  const upcoming = rows.filter((s) => s.dueRevisions.some((r) => !r.done && r.at > nowTs))

  async function open(session: LocalSession) {
    const updated = await startRevision(session)
    const dueRev = updated.dueRevisions.find((r) => !r.done && r.at <= Date.now())
    if (dueRev) {
      await db.sessions.update(updated.id, {
        dueRevisions: updated.dueRevisions.map((r) =>
          r.kind === dueRev.kind ? { ...r, done: true } : r,
        ),
      })
    }
    navigate(`/practice/${updated.type}/${updated.id}`)
  }

  return (
    <div className="stack">
      <h1 className="topic-title">다시 고쳐쓰기</h1>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>오늘 / 기한 지남</h3>
        {due.length === 0 && <p className="muted">지금 고칠 글이 없습니다.</p>}
        <div className="list">
          {due.map((s) => (
            <button key={s.id} className="item" type="button" onClick={() => void open(s)}>
              {typeLabel(s.type)} · {s.topic.title}
              <div className="muted">기한 {formatKoreanDate(s.dueRevisions.find((r) => !r.done)?.at ?? s.updatedAt)}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>예정</h3>
        {upcoming.length === 0 && <p className="muted">예정된 고쳐쓰기가 없습니다.</p>}
        <div className="list">
          {upcoming.map((s) => (
            <div key={s.id} className="item">
              {typeLabel(s.type)} · {s.topic.title}
              <div className="muted">
                {s.dueRevisions
                  .filter((r) => !r.done)
                  .map((r) => `${r.kind === 'd2' ? '2일' : '10일'} · ${formatKoreanDate(r.at)}`)
                  .join(' / ')}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
