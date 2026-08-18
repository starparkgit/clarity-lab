import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { db } from '../lib/db'
import { typeLabel } from '../lib/sessions'
import { formatKoreanDate, formatRelative } from '../lib/time'
import type { LocalSession } from '../types'

export function HomePage() {
  const { profile, topicMeta, online } = useApp()
  const [recent, setRecent] = useState<LocalSession[]>([])
  const [due, setDue] = useState<LocalSession[]>([])

  useEffect(() => {
    if (!profile) return
    void (async () => {
      const all = await db.sessions.where('profileId').equals(profile.id).toArray()
      setRecent(all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5))
      const start = Date.now()
      setDue(
        all.filter((s) =>
          s.dueRevisions.some((r) => !r.done && r.at <= start + 24 * 60 * 60 * 1000),
        ),
      )
    })()
  }, [profile])

  const stale = topicMeta.fetchedAt > 0 && Date.now() - topicMeta.fetchedAt > 7 * 24 * 60 * 60 * 1000

  return (
    <div className="stack">
      <div>
        <p className="topic-kicker">{profile?.displayName}의 연습실</p>
        <h1 className="topic-title" style={{ marginTop: 0 }}>
          오늘은 무엇을 명료하게 만들까요?
        </h1>
      </div>
      {!online && stale && (
        <div className="notice">저장된 주제로 추첨합니다. 최신 논제는 온라인에서 가져올 수 있어요.</div>
      )}
      <p className="muted">
        주제 은행 · 설명 {topicMeta.explanation}개 · 논제 {topicMeta.proposition}개
        {topicMeta.fetchedAt ? ` · ${formatRelative(topicMeta.fetchedAt)}` : ' · 시드'}
      </p>
      <div className="grid-3">
        <Link className="card entry" to="/practice/explanation">
          <h2>설명하기</h2>
          <p>주제를 추첨하고 15분 조사한 뒤, 1분짜리 설명을 씁니다.</p>
          <div className="meta">조사 15분 · 작성 10분</div>
        </Link>
        <Link className="card entry" to="/practice/argument">
          <h2>논쟁하기</h2>
          <p>기술 논제에 입장을 정하고, 논거로 설득하는 글을 씁니다.</p>
          <div className="meta">조사·작성 40분</div>
        </Link>
        <Link className="card entry" to="/practice/debate">
          <h2>토론하기</h2>
          <p>20분 준비한 뒤 외부 AI와 토론하고, 여기서는 요약만 남깁니다.</p>
          <div className="meta">조사 20분 · 요약</div>
        </Link>
      </div>
      <div className="grid-3">
        <section className="card stack">
          <h3 style={{ margin: 0 }}>오늘 다시 고쳐쓸 글</h3>
          {due.length === 0 && <p className="muted">기한이 된 글이 없습니다.</p>}
          <div className="list">
            {due.map((s) => (
              <Link key={s.id} to={`/revisions`}>
                {typeLabel(s.type)} · {s.topic.title}
              </Link>
            ))}
          </div>
        </section>
        <section className="card stack" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ margin: 0 }}>최근 기록</h3>
          {recent.length === 0 && <p className="muted">아직 세션이 없습니다. 위 카드에서 시작하세요.</p>}
          <div className="list">
            {recent.map((s) => (
              <Link
                key={s.id}
                to={s.status === 'in_progress' ? `/practice/${s.type}/${s.id}` : `/archive/${s.id}`}
              >
                {typeLabel(s.type)} · {s.topic.title}
                <div className="muted">
                  {s.status === 'in_progress' ? '이어쓰기 · ' : ''}
                  {formatKoreanDate(s.updatedAt)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
