import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  MARK_META,
  PUNCTUATION_CHOICES,
  applyMarks,
  buildProofNodes,
  canAddMark,
  charRangeAt,
  findLineBreakAt,
  isPointMark,
  knownMarks,
  makeMark,
  offsetFromPoint,
  offsetsFromSelection,
  type ProofNode,
} from '../lib/marks'
import type { Mark, MarkType } from '../types'

type PendingText = { type: 'insert' | 'replace'; start: number; end: number }
type PendingPunct = { start: number }
type SwapFirst = { start: number; end: number }

function toolHint(type: MarkType | null, waitingSecond: boolean): string {
  if (!type) return '교정 부호를 고른 뒤, 왼쪽 원고에서 클릭하거나 드래그하세요.'
  if (type === 'transpose' && waitingSecond) return '바꿀 둘째 부분을 드래그하세요.'
  return MARK_META[type].hint
}

function ProofGlyph({ node, onPick }: { node: ProofNode; onPick: (mark: Mark) => void }) {
  if (node.kind === 'text') return <span>{node.value}</span>
  const mark = node.mark
  const meta = MARK_META[mark.type]
  const pick = (e: PointerEvent) => {
    e.stopPropagation()
    onPick(mark)
  }
  if (node.kind === 'point') {
    const extra =
      mark.type === 'insert' || mark.type === 'punct' ? mark.replacement ?? '' : ''
    return (
      <span
        className={`proof-point ${meta.className}`}
        data-ins={extra}
        data-label={meta.label}
        title={`${meta.label}${extra ? ` · ${extra}` : ''}`}
        onPointerDown={pick}
        onPointerUp={(e) => e.stopPropagation()}
      />
    )
  }
  return (
    <mark
      className={`proof-range ${meta.className}${node.which === 2 ? ' is-second' : ''}`}
      data-rep={mark.type === 'replace' ? mark.replacement ?? '' : undefined}
      data-swap={mark.type === 'transpose' ? String(node.which) : undefined}
      data-label={meta.label}
      title={
        mark.type === 'replace' && mark.replacement
          ? `${meta.label} → ${mark.replacement}`
          : meta.label
      }
      onPointerDown={pick}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {node.value}
    </mark>
  )
}

export function MarkEditor({
  text,
  marks,
  onChangeMarks,
  onChangeClean,
  readOnly = false,
}: {
  text: string
  marks: Mark[]
  onChangeMarks: (marks: Mark[]) => void
  onChangeClean: (text: string) => void
  readOnly?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const ignoreUp = useRef(false)
  const marksRef = useRef(marks)
  marksRef.current = marks
  const [tool, setTool] = useState<MarkType | null>(null)
  const [pendingText, setPendingText] = useState<PendingText | null>(null)
  const [pendingPunct, setPendingPunct] = useState<PendingPunct | null>(null)
  const [draft, setDraft] = useState('')
  const [swapFirst, setSwapFirst] = useState<SwapFirst | null>(null)
  const [active, setActive] = useState<Mark | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [coach, setCoach] = useState(() => localStorage.getItem('clarity-mark-coach') !== '1')

  const liveMarks = useMemo(() => {
    const base = knownMarks(marks)
    if (!swapFirst) return base
    return [
      ...base,
      {
        id: 'pending-swap',
        type: 'transpose' as const,
        start: swapFirst.start,
        end: swapFirst.end,
        accepted: false,
      },
    ]
  }, [marks, swapFirst])

  const clean = useMemo(() => applyMarks(text, marks), [text, marks])
  const nodes = useMemo(() => buildProofNodes(text, liveMarks), [text, liveMarks])

  useEffect(() => {
    if (readOnly) return
    onChangeClean(clean)
  }, [clean, onChangeClean, readOnly])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setPendingText(null)
      setPendingPunct(null)
      setDraft('')
      setSwapFirst(null)
      setHint(null)
      setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function resetTransient() {
    setPendingText(null)
    setPendingPunct(null)
    setDraft('')
    setSwapFirst(null)
    setHint(null)
  }

  function selectTool(next: MarkType) {
    if (tool === next) {
      setTool(null)
      resetTransient()
      return
    }
    setTool(next)
    resetTransient()
    setActive(null)
  }

  function addMark(next: Omit<Mark, 'id' | 'accepted'>): boolean {
    const current = knownMarks(marksRef.current)
    if (!canAddMark(current, next)) {
      setHint('이미 교정 부호가 있는 자리입니다.')
      return false
    }
    const created = makeMark(next.type, next.start, next.end, {
      replacement: next.replacement,
      start2: next.start2,
      end2: next.end2,
    })
    const following = [...current, created]
    marksRef.current = following
    onChangeMarks(following)
    setHint(null)
    setActive(null)
    return true
  }

  function applyClickTool(type: MarkType, offset: number) {
    const pos = Math.max(0, Math.min(offset, text.length))
    if (type === 'joinLine') {
      const range = findLineBreakAt(text, pos)
      if (!range) {
        setHint('이을 줄바꿈이 없습니다.')
        return
      }
      addMark({ type, start: range.start, end: range.end })
      return
    }
    if (type === 'insert') {
      setPendingPunct(null)
      setPendingText({ type: 'insert', start: pos, end: pos })
      setDraft('')
      return
    }
    if (type === 'punct') {
      setPendingText(null)
      setPendingPunct({ start: pos })
      return
    }
    addMark({ type, start: pos, end: pos })
  }

  function applyDragTool(type: MarkType, start: number, end: number) {
    if (start === end) {
      const one = charRangeAt(text, start)
      if (!one) {
        setHint(MARK_META[type].hint)
        return
      }
      start = one.start
      end = one.end
    }
    if (type === 'join') {
      const slice = text.slice(start, end)
      if (!/[ \t\u00a0]/.test(slice)) {
        setHint('붙일 빈칸이 없습니다. 띄어 있는 글자를 드래그하세요.')
        return
      }
      addMark({ type, start, end })
      return
    }
    if (type === 'replace') {
      setPendingPunct(null)
      setPendingText({ type: 'replace', start, end })
      setDraft('')
      return
    }
    if (type === 'delete') {
      addMark({ type, start, end })
      return
    }
    if (type === 'transpose') {
      if (!swapFirst) {
        setSwapFirst({ start, end })
        setHint('바꿀 둘째 부분을 드래그하세요.')
        return
      }
      const first = swapFirst
      setSwapFirst(null)
      if (!addMark({ type: 'transpose', start: first.start, end: first.end, start2: start, end2: end })) {
        setSwapFirst(first)
      }
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (readOnly) return
    if (ignoreUp.current) {
      ignoreUp.current = false
      return
    }
    if (pendingText || pendingPunct) return
    const root = rootRef.current
    if (!root || !tool) return

    const meta = MARK_META[tool]
    window.setTimeout(() => {
      if (meta.interaction === 'click') {
        const pos = offsetFromPoint(root, e.clientX, e.clientY)
        if (pos == null) {
          setHint(meta.hint)
          return
        }
        applyClickTool(tool, pos)
        window.getSelection()?.removeAllRanges()
        return
      }
      const sel = offsetsFromSelection(root)
      if (sel && sel.start !== sel.end) {
        applyDragTool(tool, sel.start, sel.end)
      } else {
        const pos = offsetFromPoint(root, e.clientX, e.clientY) ?? sel?.start
        if (pos == null) {
          setHint(meta.hint)
          return
        }
        if (tool === 'transpose') {
          setHint('자리바꿈은 두 번 드래그하세요.')
          return
        }
        applyDragTool(tool, pos, pos)
      }
      window.getSelection()?.removeAllRanges()
    }, 0)
  }

  function confirmPendingText() {
    if (!pendingText) return
    const value = draft
    if (value.length === 0) {
      setHint(pendingText.type === 'insert' ? '넣을 글을 적으세요.' : '고친 글을 적으세요.')
      return
    }
    addMark({
      type: pendingText.type,
      start: pendingText.start,
      end: pendingText.end,
      replacement: value,
    })
    setPendingText(null)
    setDraft('')
  }

  function pickPunct(char: string) {
    if (!pendingPunct) return
    addMark({ type: 'punct', start: pendingPunct.start, end: pendingPunct.start, replacement: char })
    setPendingPunct(null)
  }

  const displayHint = hint ?? (readOnly ? '남겨 둔 교정 부호입니다.' : toolHint(tool, Boolean(swapFirst)))

  return (
    <div className={`stack revise-root${readOnly ? ' is-readonly' : ''}`}>
      {!readOnly && coach && (
        <div className="notice">
          왼쪽은 고쳐쓰기 전 원고입니다. 원고지 교정 부호를 고른 뒤 띄움·넣음·부호 넣음·줄바꿈·줄이음은 클릭하고,
          붙임·고침·지움은 드래그하세요. 자리바꿈은 바꿀 두 부분을 차례로 드래그합니다. 오른쪽에는 고친 글이 바로 보입니다.
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              localStorage.setItem('clarity-mark-coach', '1')
              setCoach(false)
            }}
          >
            알겠습니다
          </button>
        </div>
      )}

      {!readOnly && (
        <div className="mark-toolbar" role="toolbar" aria-label="원고지 교정 부호">
          {(Object.keys(MARK_META) as MarkType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={tool === type ? 'on' : undefined}
              aria-pressed={tool === type}
              title={MARK_META[type].hint}
              onClick={() => selectTool(type)}
            >
              <span className="mark-symbol" aria-hidden>
                {MARK_META[type].symbol}
              </span>
              {MARK_META[type].label}
            </button>
          ))}
          {marks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChangeMarks(knownMarks(marks).slice(0, -1))
                resetTransient()
              }}
            >
              마지막 부호 취소
            </button>
          )}
        </div>
      )}

      <p className="muted revise-hint">{displayHint}</p>

      <div className="revise-split">
        <section className="revise-pane">
          <header className="revise-pane-head">
            <h3>고쳐쓰기 전</h3>
            <span className="muted">교정 부호를 남기는 원고</span>
          </header>
          <div className="proof-wrap">
            {text.length === 0 && nodes.length === 0 && (
              <p className="proof-empty muted">아직 본문이 없습니다.</p>
            )}
            <div
              ref={rootRef}
              className={`mark-surface proof-surface${readOnly ? ' is-readonly' : ''}${tool ? ' has-tool' : ''}`}
              onPointerUp={handlePointerUp}
            >
              {nodes.map((node) => (
                <ProofGlyph
                  key={node.key}
                  node={node}
                  onPick={(mark) => {
                    if (readOnly || mark.id === 'pending-swap') return
                    ignoreUp.current = true
                    setActive(mark)
                    resetTransient()
                  }}
                />
              ))}
            </div>
          </div>
        </section>
        <section className="revise-pane">
          <header className="revise-pane-head">
            <h3>고쳐쓴 후</h3>
            <span className="muted">부호를 반영한 글</span>
          </header>
          <div className="mark-surface proof-result" aria-live="polite">
            {clean ||
              (text ? null : <span className="muted">고친 글이 여기에 나타납니다.</span>)}
          </div>
        </section>
      </div>

      {pendingText && (
        <div className="card stack">
          <p>
            {pendingText.type === 'insert'
              ? '넣을 글을 적으세요.'
              : `고칠 글: “${text.slice(pendingText.start, pendingText.end)}”`}
          </p>
          <textarea
            className="editor"
            style={{ minHeight: 90 }}
            value={draft}
            placeholder={pendingText.type === 'replace' ? '바른 글' : '넣을 글'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                confirmPendingText()
              }
              if (e.key === 'Escape') setPendingText(null)
            }}
            autoFocus
          />
          <div className="row">
            <button className="btn primary" type="button" onClick={confirmPendingText}>
              적용
            </button>
            <button className="btn ghost" type="button" onClick={() => setPendingText(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      {pendingPunct && (
        <div className="card stack">
          <p>넣을 부호를 고르세요.</p>
          <div className="punct-grid">
            {PUNCTUATION_CHOICES.map((item) => (
              <button
                key={`${item.name}-${item.char}`}
                type="button"
                className="btn"
                onClick={() => pickPunct(item.char)}
              >
                <strong>{item.char}</strong>
                <span className="muted">{item.name}</span>
              </button>
            ))}
          </div>
          <button className="btn ghost" type="button" onClick={() => setPendingPunct(null)}>
            취소
          </button>
        </div>
      )}

      {active && !readOnly && (
        <div className="card">
          <p>
            {MARK_META[active.type].label}
            {active.replacement ? ` → ${active.replacement}` : ''}
            {active.type === 'transpose' && active.start2 != null && active.end2 != null
              ? ` · “${text.slice(active.start, active.end)}” ∽ “${text.slice(active.start2, active.end2)}”`
              : !isPointMark(active.type) && active.type !== 'transpose'
                ? ` · ${text.slice(active.start, active.end).replace(/\n/g, '↵')}`
                : ''}
          </p>
          <div className="row">
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                onChangeMarks(marks.filter((m) => m.id !== active.id))
                setActive(null)
              }}
            >
              이 부호 취소
            </button>
            <button className="btn ghost" type="button" onClick={() => setActive(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
