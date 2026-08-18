const KO_RELATIVE = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${pad2(m)}:${pad2(s)}`
}

export function formatKoreanDate(ts: number): string {
  return new Date(ts).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelative(ts: number, from = Date.now()): string {
  const diff = ts - from
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < hour) {
    const mins = Math.round(diff / minute)
    return KO_RELATIVE.format(mins, 'minute')
  }
  if (abs < day) {
    const hours = Math.round(diff / hour)
    return KO_RELATIVE.format(hours, 'hour')
  }
  const days = Math.round(diff / day)
  return KO_RELATIVE.format(days, 'day')
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function daysFrom(ts: number, days: number): number {
  return ts + days * 24 * 60 * 60 * 1000
}

export function countKoreanChars(text: string): number {
  return [...text.replace(/\s+/g, '')].length
}

export function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export function minuteHint(language: 'ko' | 'en', text: string): string {
  if (language === 'ko') {
    const n = countKoreanChars(text)
    if (n < 180) return `공백 제외 ${n}자 · 조금 더 채워도 됩니다`
    if (n <= 380) return `공백 제외 ${n}자 · 약 1분에 가깝습니다`
    return `공백 제외 ${n}자 · 1분을 넘길 수 있습니다`
  }
  const n = countWords(text)
  if (n < 100) return `${n} words · a bit short for 1 minute`
  if (n <= 170) return `${n} words · about 1 minute`
  return `${n} words · may run long`
}
