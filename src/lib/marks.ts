import type { Mark } from '../types'
import { createId } from './id'

export const MARK_META: Record<
  Mark['type'],
  { label: string; symbol: string; needsText: boolean; className: string }
> = {
  delete: { label: '삭제', symbol: '✗', needsText: false, className: 'mark-delete' },
  insert: { label: '삽입', symbol: '∧', needsText: true, className: 'mark-insert' },
  replace: { label: '바꿔쓰기', symbol: '○', needsText: true, className: 'mark-replace' },
  transpose: { label: '자리바꿈', symbol: '⇄', needsText: false, className: 'mark-transpose' },
  join: { label: '붙이기', symbol: '⌒', needsText: false, className: 'mark-join' },
  space: { label: '띄우기', symbol: '∨', needsText: false, className: 'mark-space' },
  break: { label: '줄 나누기', symbol: '↵', needsText: false, className: 'mark-break' },
  joinLine: { label: '이어쓰기', symbol: '⤷', needsText: false, className: 'mark-join-line' },
  note: { label: '메모', symbol: '✎', needsText: true, className: 'mark-note' },
}

export function rangesOverlap(a: Mark, b: Mark): boolean {
  return a.start < b.end && b.start < a.end
}

export function canAddMark(existing: Mark[], next: Omit<Mark, 'id' | 'accepted'>): boolean {
  if (next.start > next.end) return false
  if (next.type !== 'insert' && next.type !== 'note' && next.start === next.end) return false
  const probe: Mark = { ...next, id: 'tmp', accepted: true }
  return !existing.some((m) => rangesOverlap(m, probe))
}

export function makeMark(
  type: Mark['type'],
  start: number,
  end: number,
  extra?: { replacement?: string; note?: string },
): Mark {
  return {
    id: createId(),
    type,
    start,
    end,
    accepted: true,
    replacement: extra?.replacement,
    note: extra?.note,
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

export function applyMarks(text: string, marks: Mark[]): string {
  const accepted = marks
    .filter((m) => m.accepted && m.type !== 'note')
    .slice()
    .sort((a, b) => b.start - a.start)

  let result = text
  for (const mark of accepted) {
    const before = result.slice(0, mark.start)
    const target = result.slice(mark.start, mark.end)
    const after = result.slice(mark.end)
    switch (mark.type) {
      case 'delete':
        result = before + after
        break
      case 'insert':
        result = before + (mark.replacement ?? '') + target + after
        break
      case 'replace':
        result = before + (mark.replacement ?? '') + after
        break
      case 'transpose':
        result = before + transposeChunk(target) + after
        break
      case 'join':
        result = before + target.replace(/\s+/g, '') + after
        break
      case 'space':
        result = before + ' ' + target + after
        break
      case 'break':
        result = before + '\n' + target + after
        break
      case 'joinLine':
        result = before + target.replace(/\n+/g, ' ') + after
        break
      default:
        break
    }
  }
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
