import type { Mark, MarkType } from '../types'
import { MARK_TYPES } from '../types'
import { createId } from './id'

export const MARK_META: Record<
  MarkType,
  {
    label: string
    symbol: string
    hint: string
    className: string
    needsText: boolean
    interaction: 'click' | 'drag' | 'two-drag'
  }
> = {
  space: {
    label: '띄움',
    symbol: '∨',
    hint: '띄어 쓸 곳을 클릭하세요.',
    className: 'proof-space',
    needsText: false,
    interaction: 'click',
  },
  join: {
    label: '붙임',
    symbol: '⌒',
    hint: '붙여 쓸 글자를 드래그하세요.',
    className: 'proof-join',
    needsText: false,
    interaction: 'drag',
  },
  insert: {
    label: '넣음',
    symbol: '∨',
    hint: '넣을 위치를 클릭하세요.',
    className: 'proof-insert',
    needsText: true,
    interaction: 'click',
  },
  replace: {
    label: '고침',
    symbol: '○',
    hint: '고칠 글자를 드래그하세요. 한 글자는 클릭해도 됩니다.',
    className: 'proof-replace',
    needsText: true,
    interaction: 'drag',
  },
  punct: {
    label: '부호 넣음',
    symbol: '∧,',
    hint: '부호를 넣을 곳을 클릭하세요.',
    className: 'proof-punct',
    needsText: true,
    interaction: 'click',
  },
  delete: {
    label: '지움',
    symbol: '／',
    hint: '지울 글자를 드래그하세요. 한 글자는 클릭해도 됩니다.',
    className: 'proof-delete',
    needsText: false,
    interaction: 'drag',
  },
  transpose: {
    label: '자리바꿈',
    symbol: '∽',
    hint: '바꿀 첫째 부분을 드래그한 뒤, 둘째 부분을 다시 드래그하세요.',
    className: 'proof-transpose',
    needsText: false,
    interaction: 'two-drag',
  },
  break: {
    label: '줄바꿈',
    symbol: '↵',
    hint: '줄을 바꿀 곳을 클릭하세요.',
    className: 'proof-break',
    needsText: false,
    interaction: 'click',
  },
  joinLine: {
    label: '줄이음',
    symbol: '╰',
    hint: '이을 줄바꿈 위치를 클릭하세요.',
    className: 'proof-join-line',
    needsText: false,
    interaction: 'click',
  },
}

export const PUNCTUATION_CHOICES: { char: string; name: string }[] = [
  { char: ',', name: '쉼표' },
  { char: '.', name: '마침표' },
  { char: '?', name: '물음표' },
  { char: '!', name: '느낌표' },
  { char: '·', name: '가운뎃점' },
  { char: '…', name: '줄임표' },
  { char: ':', name: '쌍점' },
  { char: ';', name: '쌍반점' },
  { char: '~', name: '물결표' },
  { char: '—', name: '줄표' },
  { char: '「', name: '여는 낫표' },
  { char: '」', name: '닫는 낫표' },
  { char: '『', name: '여는 겹낫표' },
  { char: '』', name: '닫는 겹낫표' },
  { char: '(', name: '여는 괄호' },
  { char: ')', name: '닫는 괄호' },
  { char: '"', name: '큰따옴표' },
  { char: "'", name: '작은따옴표' },
]

export function isMarkType(value: string): value is MarkType {
  return (MARK_TYPES as readonly string[]).includes(value)
}

export function isPointMark(type: MarkType): boolean {
  return type === 'space' || type === 'insert' || type === 'punct' || type === 'break'
}

export function knownMarks(marks: Mark[]): Mark[] {
  return marks.filter((m) => isMarkType(m.type))
}

function markIntervals(mark: Pick<Mark, 'start' | 'end' | 'start2' | 'end2'>): [number, number][] {
  const out: [number, number][] = [[mark.start, mark.end]]
  if (mark.start2 != null && mark.end2 != null) out.push([mark.start2, mark.end2])
  return out
}

export function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  if (a0 === a1 && b0 === b1) return false
  if (a0 === a1) return b0 < a0 && a0 < b1
  if (b0 === b1) return a0 < b0 && b0 < a1
  return a0 < b1 && b0 < a1
}

export function rangesOverlap(a: Mark, b: Mark): boolean {
  return markIntervals(a).some(([a0, a1]) =>
    markIntervals(b).some(([b0, b1]) => intervalsOverlap(a0, a1, b0, b1)),
  )
}

export function canAddMark(existing: Mark[], next: Omit<Mark, 'id' | 'accepted'>): boolean {
  if (next.start > next.end) return false
  if (next.start2 != null && next.end2 != null && next.start2 > next.end2) return false
  if (isPointMark(next.type)) {
    if (next.start !== next.end) return false
  } else if (next.start === next.end) {
    return false
  }
  if (next.type === 'transpose') {
    if (next.start2 == null || next.end2 == null || next.start2 === next.end2) return false
    if (intervalsOverlap(next.start, next.end, next.start2, next.end2)) return false
  }
  const probe: Mark = { ...next, id: 'tmp', accepted: true }
  if (
    existing.some(
      (m) =>
        m.type === next.type &&
        m.start === next.start &&
        m.end === next.end &&
        (m.start2 ?? null) === (next.start2 ?? null) &&
        (m.end2 ?? null) === (next.end2 ?? null),
    )
  ) {
    return false
  }
  return !existing.some((m) => rangesOverlap(m, probe))
}

export function makeMark(
  type: MarkType,
  start: number,
  end: number,
  extra?: { replacement?: string; start2?: number; end2?: number },
): Mark {
  return {
    id: createId(),
    type,
    start,
    end,
    accepted: true,
    replacement: extra?.replacement,
    start2: extra?.start2,
    end2: extra?.end2,
  }
}

function transposeChunk(chunk: string): string {
  const parts = chunk.split(/(\s+)/)
  const words = parts.filter((_, i) => i % 2 === 0 && parts[i] !== '')
  if (words.length < 2) return chunk
  const [first, second, ...rest] = words
  const rebuilt = [second, first, ...rest]
  const spaces = parts.filter((_, i) => i % 2 === 1)
  let out = rebuilt[0] ?? ''
  for (let i = 0; i < spaces.length && i + 1 < rebuilt.length; i += 1) {
    out += spaces[i] + rebuilt[i + 1]
  }
  return out
}

type SpanEdit = { start: number; end: number; output: string; tie: number }

function editsFromMark(text: string, mark: Mark, tie: number): SpanEdit[] {
  switch (mark.type) {
    case 'delete':
      return [{ start: mark.start, end: mark.end, output: '', tie }]
    case 'insert':
    case 'punct':
      return [{ start: mark.start, end: mark.end, output: mark.replacement ?? '', tie }]
    case 'space':
      return [{ start: mark.start, end: mark.end, output: ' ', tie }]
    case 'break':
      return [{ start: mark.start, end: mark.end, output: '\n', tie }]
    case 'replace':
      return [{ start: mark.start, end: mark.end, output: mark.replacement ?? '', tie }]
    case 'join':
      return [
        {
          start: mark.start,
          end: mark.end,
          output: text.slice(mark.start, mark.end).replace(/[ \t\u00a0]+/g, ''),
          tie,
        },
      ]
    case 'joinLine':
      return [
        {
          start: mark.start,
          end: mark.end,
          output: text.slice(mark.start, mark.end).replace(/\n+/g, ''),
          tie,
        },
      ]
    case 'transpose': {
      if (mark.start2 != null && mark.end2 != null) {
        const a = text.slice(mark.start, mark.end)
        const b = text.slice(mark.start2, mark.end2)
        return [
          { start: mark.start, end: mark.end, output: b, tie },
          { start: mark.start2, end: mark.end2, output: a, tie },
        ]
      }
      return [
        {
          start: mark.start,
          end: mark.end,
          output: transposeChunk(text.slice(mark.start, mark.end)),
          tie,
        },
      ]
    }
    default:
      return []
  }
}

export function applyMarks(text: string, marks: Mark[]): string {
  const accepted = knownMarks(marks).filter((m) => m.accepted)
  const edits = accepted.flatMap((mark, i) => editsFromMark(text, mark, i))
  edits.sort((a, b) => a.start - b.start || a.end - b.end || a.tie - b.tie)

  let result = ''
  let cursor = 0
  for (const edit of edits) {
    if (edit.start < cursor) continue
    result += text.slice(cursor, edit.start)
    result += edit.output
    cursor = edit.end
  }
  result += text.slice(cursor)
  return result
}

export function offsetsFromSelection(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null

  const pre = document.createRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length
  const end = start + range.toString().length
  return { start, end }
}

export function offsetFromPoint(root: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  let range: Range | null = null
  if (typeof doc.caretRangeFromPoint === 'function') {
    range = doc.caretRangeFromPoint(x, y)
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  }
  if (!range || !root.contains(range.startContainer)) return null
  const pre = document.createRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}

export function findLineBreakAt(text: string, offset: number): { start: number; end: number } | null {
  const clamped = Math.max(0, Math.min(offset, text.length))
  const expand = (at: number) => {
    let start = at
    let end = at + 1
    while (start > 0 && text[start - 1] === '\n') start -= 1
    while (end < text.length && text[end] === '\n') end += 1
    return { start, end }
  }
  if (text[clamped] === '\n') return expand(clamped)
  if (clamped > 0 && text[clamped - 1] === '\n') return expand(clamped - 1)
  const next = text.indexOf('\n', clamped)
  const prev = text.lastIndexOf('\n', clamped - 1)
  if (next < 0 && prev < 0) return null
  if (next < 0) return expand(prev)
  if (prev < 0) return expand(next)
  return clamped - prev <= next - clamped ? expand(prev) : expand(next)
}

export function charRangeAt(text: string, offset: number): { start: number; end: number } | null {
  if (text.length === 0) return null
  if (offset >= text.length) {
    return { start: text.length - 1, end: text.length }
  }
  const start = Math.max(0, offset)
  return { start, end: start + 1 }
}

export type ProofNode =
  | { kind: 'text'; key: string; value: string }
  | { kind: 'range'; key: string; value: string; mark: Mark; which: 1 | 2 }
  | { kind: 'point'; key: string; mark: Mark }

function coversRange(mark: Mark, from: number, to: number, which: 1 | 2): boolean {
  if (which === 1) return mark.start < to && from < mark.end
  return mark.start2 != null && mark.end2 != null && mark.start2 < to && from < mark.end2
}

export function buildProofNodes(text: string, marks: Mark[]): ProofNode[] {
  const list = knownMarks(marks)
  const cuts = new Set<number>([0, text.length])
  for (const mark of list) {
    cuts.add(mark.start)
    cuts.add(mark.end)
    if (mark.start2 != null) cuts.add(mark.start2)
    if (mark.end2 != null) cuts.add(mark.end2)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const nodes: ProofNode[] = []

  for (let i = 0; i < points.length; i += 1) {
    const pos = points[i]
    for (const mark of list) {
      if (isPointMark(mark.type) && mark.start === pos) {
        nodes.push({ kind: 'point', key: `${mark.id}-${pos}`, mark })
      }
    }
    if (i === points.length - 1) break
    const next = points[i + 1]
    if (next <= pos) continue
    const slice = text.slice(pos, next)
    const covering = list.find((mark) => coversRange(mark, pos, next, 1) || coversRange(mark, pos, next, 2))
    if (covering) {
      const which: 1 | 2 = coversRange(covering, pos, next, 1) ? 1 : 2
      nodes.push({
        kind: 'range',
        key: `${covering.id}-${pos}-${which}`,
        value: slice,
        mark: covering,
        which,
      })
    } else {
      nodes.push({ kind: 'text', key: `t-${pos}`, value: slice })
    }
  }
  return nodes
}
