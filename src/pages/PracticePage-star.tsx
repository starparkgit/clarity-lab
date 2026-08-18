import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MarkEditor } from '../components/MarkEditor'
import { Stepper } from '../components/Stepper'
import { TimerBar } from '../components/TimerBar'
import { TopicDraw } from '../components/TopicDraw'
import { useApp } from '../context/AppContext'
import { buildExternalDebatePrompt } from '../lib/debatePrompt'
import { db } from '../lib/db'
import {
  STEPS,
  STEP_MS,
  advanceStep,
  createSession,
  latestDocument,
  latestVersionNumber,
  nextStep,
  stanceLabel,
  topicSnapshotFromItem,
  touchSession,
  typeLabel,
  upsertDocument,
} from '../lib/sessions'
import { applyMarks } from '../lib/marks'
import { flushSyncQueue } from '../lib/sync'
import { minuteHint } from '../lib/time'
import type {
  DebateChecklist,
  LocalSession,
  Mark,
  ReasonSlot,
  SessionType,
  StanceSide,
  TopicItem,
  WritingLanguage,
} from '../types'

function isType(v: string | undefined): v is SessionType {
  return v === 'explanation' || v === 'argument' || v === 'debate'
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export function PracticePage() {
  const { type: typeParam, id } = useParams()
  const navigate = useNavigate()
  const { profile, setNotice, updateProfileSettings } = useApp()
  const type: SessionType = isType(typeParam) ? typeParam : 'explanation'
  const [session, setSession] = useState<LocalSession | null>(null)
  const [research, setResearch] = useState('')
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState('')
  const [clean, setClean] = useState('')
  const [marks, setMarks] = useState<Mark[]>([])
  const [cards, setCards] = useState('')
  const [summary, setSummary] = useState('')
  const [side, setSide] = useState<StanceSide>('for')
  const [reasons, setReasons] = useState<ReasonSlot[]>([
    { reason: '', support: '' },
    { reason: '', support: '' },
    { reason: '', support: '' },
  ])
  const [check, setCheck] = useState<DebateChecklist>({
    started: false,
    threeTurns: false,
    ended: false,
  })
  const [later, setLater] = useState(false)
  const [saveEnabled, setSaveEnabled] = useState(false)

  const language: WritingLanguage = session?.language ?? profile?.lastWritingLanguage ?? 'ko'
  const [version, setVersion] = useState(1)

  const draftState = {
    session,
    version,
    research,
    draft,
    feedback,
    clean,
    marks,
    cards,
    summary,
    side,
    reasons,
  }
  const stateRef = useRef(draftState)
  stateRef.current = draftState
  const dirtyRef = useRef(false)
  const hydratedRef = useRef(false)
  const mountedRef = useRef(true)
  const persistLock = useRef<Promise<void> | null>(null)

  const persist = useCallback(async () => {
    const run = async () => {
      const s = stateRef.current
      if (!s.session) return
      await upsertDocument({ session: s.session, role: 'researchNotes', version: s.version, text: s.research })
      await upsertDocument({ session: s.session, role: 'draft', version: s.version, text: s.draft })
      await upsertDocument({ session: s.session, role: 'feedback', version: s.version, text: s.feedback })
      await upsertDocument({ session: s.session, role: 'clean', version: s.version, text: s.clean })
      await upsertDocument({ session: s.session, role: 'annotated', version: s.version, text: s.draft, marks: s.marks })
      await upsertDocument({ session: s.session, role: 'stanceCards', version: s.version, text: s.cards })
      await upsertDocument({ session: s.session, role: 'debateSummary', version: s.version, text: s.summary })
      const patch =
        s.session.type === 'argument' ? { stance: { side: s.side, reasons: s.reasons } } : {}
      const next = await touchSession(s.session, patch)
      stateRef.current = { ...stateRef.current, session: next }
      if (mountedRef.current) setSession(next)
      await flushSyncQueue()
      dirtyRef.current = false
    }
    if (persistLock.current) await persistLock.current
    persistLock.current = run().finally(() => {
      persistLock.current = null
    })
    await persistLock.current
  }, [])

  const load = useCallback(async (sess: LocalSession) => {
    setSession(sess)
    const v = await latestVersionNumber(sess.id)
    setVersion(v)
    const [r, d, f, c, a, cardsDoc, sum] = await Promise.all([
      latestDocument(sess.id, 'researchNotes'),
      latestDocument(sess.id, 'draft'),
      latestDocument(sess.id, 'feedback'),
      latestDocument(sess.id, 'clean'),
      latestDocument(sess.id, 'annotated'),
      latestDocument(sess.id, 'stanceCards'),
      latestDocument(sess.id, 'debateSummary'),
    ])
    setResearch(r?.text ?? '')
    setDraft(d?.text ?? '')
    setFeedback(f?.text ?? '')
    setClean(c?.text ?? d?.text ?? '')
    setMarks(a?.marks ?? [])
    setCards(cardsDoc?.text ?? '')
    setSummary(sum?.text ?? '')
    if (sess.stance) {
      setSide(sess.stance.side)
      setReasons(sess.stance.reasons.concat([{ reason: '', support: '' }]).slice(0, 3))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    hydratedRef.current = false
    setSaveEnabled(false)
    if (!id) {
      setSession(null)
      return
    }
    let cancelled = false
    void db.sessions.get(id).then(async (s) => {
      if (!s || cancelled) return
      await load(s)
      if (!cancelled) setSaveEnabled(true)
    })
    return () => {
      cancelled = true
    }
  }, [id, load])

  useEffect(() => {
    if (!saveEnabled) return
    if (!hydratedRef.current) {
      hydratedRef.current = true
      return
    }
    dirtyRef.current = true
    const t = window.setTimeout(() => {
      if (dirtyRef.current) void persist()
    }, 1200)
    return () => window.clearTimeout(t)
  }, [saveEnabled, research, draft, feedback, clean, marks, cards, summary, side, reasons, version, persist])

  useEffect(() => {
    if (!saveEnabled) return
    const t = window.setInterval(() => {
      if (dirtyRef.current) void persist()
    }, 10_000)
    return () => window.clearInterval(t)
  }, [saveEnabled, persist])

  useEffect(() => {
    const saveIfDirty = () => {
      if (dirtyRef.current) void persist()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveIfDirty()
    }
    window.addEventListener('pagehide', saveIfDirty)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', saveIfDirty)
      document.removeEventListener('visibilitychange', onVisibility)
      saveIfDirty()
    }
  }, [persist])

  async function startWith(item: TopicItem) {
    if (!profile) return
    const created = await createSession({
      profileId: profile.id,
      userId: profile.userId,
      type,
      topic: topicSnapshotFromItem(item),
      language,
    })
    navigate(`/practice/${type}/${created.id}`, { replace: true })
  }

  async function goNext() {
    const current = stateRef.current.session
    if (!current) return
    if (current.step === 'feedback' && !feedback.trim() && !later) {
      setNotice('피드백을 적거나 ‘나중에 쓰기’를 눌러 주세요.')
      return
    }
    if (current.step === 'revise') {
      const applied = clean || applyMarks(draft, marks)
      await upsertDocument({ session: current, role: 'clean', version, text: applied })
    }
    await persist()
    const latest = stateRef.current.session
    if (!latest) return
    const next = nextStep(latest.type, latest.step)
    const updated = await advanceStep(latest, next)
    setSession(updated)
    if (next === 'done') {
      setNotice('세션을 저장했습니다.')
      navigate(`/archive/${updated.id}`)
    }
  }

  async function saveAndLeave() {
    await persist()
    navigate('/')
  }

  const writeDuration = type === 'argument' ? STEP_MS.writeArgument : STEP_MS.writeExplanation
  const researchDuration = type === 'debate' ? STEP_MS.debateResearch : STEP_MS.research
  const filledReasons = reasons.filter((r) => r.reason.trim()).length

  const promptText = useMemo(() => {
    if (!session) return ''
    return buildExternalDebatePrompt(session.topic, cards)
  }, [session, cards])

  if (!profile) return <p>프로필을 준비하는 중입니다.</p>

  if (!session) {
    return (
      <div className="card stack">
        <p className="topic-kicker">{typeLabel(type)}</p>
        <TopicDraw bank={type === 'explanation' ? 'explanation' : 'proposition'} profileId={profile.id} onChoose={(item) => void startWith(item)} />
      </div>
    )
  }

  const step = session.step

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="topic-kicker">{typeLabel(session.type)}</p>
          <h1 className="topic-title">{session.topic.title}</h1>
          {session.topic.prompt && <p className="muted">{session.topic.prompt}</p>}
        </div>
        <button
          className="lang-chip"
          type="button"
          onClick={() => {
            const next = language === 'ko' ? 'en' : 'ko'
            void touchSession(session, { language: next }).then(setSession)
            void updateProfileSettings({ lastWritingLanguage: next })
          }}
        >
          {language === 'ko' ? '한국어' : 'English'}
        </button>
      </div>
      <Stepper
        type={session.type}
        current={step}
        onSelect={(s) => {
          if (STEPS[session.type].indexOf(s) <= STEPS[session.type].indexOf(step)) {
            void touchSession(session, { step: s }).then(setSession)
          }
        }}
      />

      {step === 'research' && (
        <>
          <TimerBar startedAt={session.stepStartedAt} durationMs={researchDuration} label="조사" />
          <p className="muted">
            {type === 'debate'
              ? '20분 동안 토론 카드를 채우세요. 오프라인이면 아는 것과 추론으로 골격을 만드세요.'
              : '15분 동안 핵심만 조사하세요. 오프라인이면 이미 아는 것과 추론으로 골격을 만드세요.'}
          </p>
          <textarea className="editor" value={research} onChange={(e) => setResearch(e.target.value)} placeholder="조사 메모" />
          {type === 'debate' && (
            <textarea
              className="editor"
              value={cards}
              onChange={(e) => setCards(e.target.value)}
              placeholder={'토론 카드\n정의:\n찬성 1-3:\n반대 1-3:\n질문 1-2:'}
            />
          )}
        </>
      )}

      {step === 'stance' && (
        <div className="stack">
          {session.topic.backgroundBullets && (
            <ul>
              {session.topic.backgroundBullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <div className="row">
            {([
              ['for', '찬성'],
              ['against', '반대'],
              ['conditional', '조건부 찬성'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={`btn${side === value ? ' primary' : ''}`}
                type="button"
                onClick={() => setSide(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {reasons.map((slot, i) => (
            <div key={i} className="card stack">
              <strong>논거 {i + 1}</strong>
              <input
                type="text"
                placeholder="이유"
                value={slot.reason}
                onChange={(e) =>
                  setReasons((rows) => rows.map((r, idx) => (idx === i ? { ...r, reason: e.target.value } : r)))
                }
              />
              <input
                type="text"
                placeholder="뒷받침"
                value={slot.support}
                onChange={(e) =>
                  setReasons((rows) => rows.map((r, idx) => (idx === i ? { ...r, support: e.target.value } : r)))
                }
              />
            </div>
          ))}
          <p>
            나의 입장: {stanceLabel(side)}
            {reasons
              .filter((r) => r.reason.trim())
              .map((r) => ` · ${r.reason}`)
              .join('')}
          </p>
        </div>
      )}

      {step === 'write' && (
        <>
          <TimerBar
            startedAt={session.stepStartedAt}
            durationMs={writeDuration}
            label={type === 'argument' ? '조사·주장 글' : '1분 설명'}
          />
          {type === 'argument' && (
            <textarea
              className="editor"
              style={{ minHeight: 140 }}
              value={research}
              onChange={(e) => setResearch(e.target.value)}
              placeholder="조사 메모"
            />
          )}
          <p className="muted">
            {type === 'explanation'
              ? '한 줄 정의 → 왜 중요한가 → 핵심 2~3가지 → 짧은 예 → 한 줄 마무리'
              : '주장 → 논거1/증거 → 논거2/증거 → 반론 인정 후 재반박 → 결론'}
          </p>
          <textarea className="editor" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="본문" />
          <p className="muted">{minuteHint(language, draft)}</p>
        </>
      )}

      {step === 'feedback' && (
        <div className="stack">
          <div className="card">
            <p className="muted">초고</p>
            <div className="mark-surface" style={{ minHeight: 120 }}>
              {draft || '아직 본문이 없습니다.'}
            </div>
          </div>
          <p className="muted">
            {type === 'explanation' &&
              '1분 안에 말할 수 있는가 / 처음 듣는 사람이 이해하는가 / 빠진 핵심 / 다음에 바꿀 한 가지'}
            {type === 'argument' &&
              '입장이 한 문장으로 분명한가 / 논거가 연결되는가 / 반론을 정직하게 다뤘는가 / 과장·빈 구호는 없는가'}
            {type === 'debate' && '준비한 카드가 실제 토론에서 통했는가 / 다음에 보강할 증거는 무엇인가'}
          </p>
          <textarea className="editor" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="스스로 쓰는 피드백" />
          <label className="muted">
            <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} /> 나중에 쓰기
          </label>
        </div>
      )}

      {step === 'revise' && (
        <MarkEditor
          text={draft}
          marks={marks}
          onChangeMarks={setMarks}
          onChangeClean={setClean}
        />
      )}

      {step === 'debate' && (
        <div className="stack">
          <p>외부 AI(ChatGPT, Claude, Gemini 등) 또는 사람과 토론하세요. 이 앱은 상대를 만들지 않습니다.</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => void copyText(session.topic.title)}>
              논제 복사
            </button>
            <button className="btn" type="button" onClick={() => void copyText(cards)}>
              카드 복사
            </button>
            <button className="btn primary" type="button" onClick={() => void copyText(promptText)}>
              외부 AI 프롬프트 복사
            </button>
          </div>
          <pre className="card" style={{ whiteSpace: 'pre-wrap' }}>
            {promptText}
          </pre>
          <div className="checklist stack">
            <label>
              <input
                type="checkbox"
                checked={check.started}
                onChange={(e) => setCheck({ ...check, started: e.target.checked })}
              />
              시작함
            </label>
            <label>
              <input
                type="checkbox"
                checked={check.threeTurns}
                onChange={(e) => setCheck({ ...check, threeTurns: e.target.checked })}
              />
              3턴 이상 진행
            </label>
            <label>
              <input
                type="checkbox"
                checked={check.ended}
                onChange={(e) => setCheck({ ...check, ended: e.target.checked })}
              />
              종료함
            </label>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <textarea
          className="editor"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={'상대의 핵심 주장:\n내가 잘 막은 점:\n막히거나 양보한 점:\n결정적 질문:\n다음에 보강할 증거:'}
        />
      )}

      <div className="row">
        {step === 'stance' && filledReasons < 2 ? (
          <p className="muted">논거를 두 개 이상 채운 뒤 다음으로 갈 수 있습니다.</p>
        ) : (
          <button
            className="btn primary"
            type="button"
            onClick={async () => {
              if (step === 'stance') {
                await persist()
                const latest = stateRef.current.session
                if (!latest) return
                const withStance = await touchSession(latest, { stance: { side, reasons } })
                const next = nextStep(withStance.type, withStance.step)
                const updated = await advanceStep(withStance, next)
                setSession(updated)
                return
              }
              void goNext()
            }}
          >
            다음 단계로
          </button>
        )}
        <button className="btn ghost" type="button" onClick={() => void saveAndLeave()}>
          나중에 이어쓰기
        </button>
      </div>
    </div>
  )
}
