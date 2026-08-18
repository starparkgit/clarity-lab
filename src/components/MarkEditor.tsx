import { useRef, useState } from 'react'
import { applyMarks, canAddMark, makeMark, MARK_META, offsetsFromSelection } from '../lib/marks'
import type { Mark, MarkType } from '../types'

export function MarkEditor({
  text,
  marks,
  onChangeMarks,
  onChangeClean,
}: {
  text: string
  marks: Mark[]
  onChangeMarks: (marks: Mark[]) => void
  onChangeClean: (text: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState(false)
  const [pending, setPending] = useState<{ type: MarkType; start: number; end: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [coach, setCoach] = useState(() => localStorage.getItem('clarity-mark-coach') !== '1')
  const [active, setActive] = useState<Mark | null>(null)
  const clean = applyMarks(text, marks)

  function applyType(type: MarkType) {
    const root = rootRef.current
    if (!root) return
    const range = offsetsFromSelection(root)
    if (!range) return
    const start = type === 'insert' ? range.start : range.start
    const end = type === 'insert' ? range.start : range.end
    const probe = { type, start, end }
    if (!canAddMark(marks, probe)) return
    if (MARK_META[type].needsText) {
      setPending({ type, start, end })
      setDraft('')
      return
    }
    onChangeMarks([...marks, makeMark(type, start, end)])
  }

  function confirmPending() {
    if (!pending) return
    const extra =
      pending.type === 'note' ? { note: draft } : { replacement: draft }
    onChangeMarks([...marks, makeMark(pending.type, pending.start, pending.end, extra)])
    setPending(null)
    setDraft('')
  }

  function renderMarked() {
    const sorted = marks.slice().sort((a, b) => a.start - b.start)
    const parts: { key: string; text: string; mark?: Mark }[] = []
    let cursor = 0
    for (const mark of sorted) {
      if (mark.start > cursor) {
        parts.push({ key: `t-${cursor}`, text: text.slice(cursor, mark.start) })
      }
      parts.push({
        key: mark.id,
        text: text.slice(mark.start, mark.end) || MARK_META[mark.type].symbol,
        mark,
      })
      cursor = Math.max(cursor, mark.end)
    }
    if (cursor < text.length) parts.push({ key: 'tail', text: text.slice(cursor) })
    return parts.map((part) =>
      part.mark ? (
        <mark
          key={part.key}
          className={MARK_META[part.mark.type].className}
          title={part.mark.note || MARK_META[part.mark.type].label}
          onClick={(e) => {
            e.stopPropagation()
            setActive(part.mark ?? null)
          }}
        >
          {part.text}
        </mark>
      ) : (
        <span key={part.key}>{part.text}</span>
      ),
    )
  }

  return (
    <div className="stack">
      {coach && (
        <div className="notice">
          글을 드래그한 뒤 위 단추를 누르면 교정 부호가 붙습니다. 삽입·바꿔쓰기는 짧은 칸이 열립니다.
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
      <div className="mark-toolbar">
        {(Object.keys(MARK_META) as MarkType[]).map((type) => (
          <button key={type} type="button" onClick={() => applyType(type)}>
            {MARK_META[type].symbol} {MARK_META[type].label}
          </button>
        ))}
        <button type="button" onClick={() => {
          setPreview((v) => !v)
          onChangeClean(clean)
        }}>
          {preview ? '부호 보기로' : '고친 글 미리보기'}
        </button>
      </div>
      {preview ? (
        <textarea
          className="editor"
          value={clean}
          onChange={(e) => onChangeClean(e.target.value)}
        />
      ) : (
        <div ref={rootRef} className="mark-surface">
          {renderMarked()}
        </div>
      )}
      {pending && (
        <div className="card">
          <p>
            {MARK_META[pending.type].label}할 내용을 적으세요.
          </p>
          <textarea
            className="editor"
            style={{ minHeight: 90 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                confirmPending()
              }
              if (e.key === 'Escape') setPending(null)
            }}
            autoFocus
          />
          <div className="row">
            <button className="btn primary" type="button" onClick={confirmPending}>
              적용
            </button>
            <button className="btn ghost" type="button" onClick={() => setPending(null)}>
              취소
            </button>
          </div>
        </div>
      )}
      {active && (
        <div className="card">
          <p>
            {MARK_META[active.type].label}
            {active.replacement ? ` → ${active.replacement}` : ''}
            {active.note ? ` · ${active.note}` : ''}
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
