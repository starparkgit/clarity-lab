import { buildSeedTopics } from '../data/seedTopics'
import type { TopicBank, TopicItem } from '../types'
import { db, getMeta, setMeta } from './db'
import { isOnline } from './network'
import { supabase } from './supabase'

const STALE_MS = 24 * 60 * 60 * 1000

type TopicRow = {
  id: string
  bank: TopicBank
  title: string | null
  prompt: string | null
  claim: string | null
  background_bullets: string[] | null
  keywords: string[] | null
  tags: string[] | null
  difficulty: string | null
  source: TopicItem['source']
  fetched_at: string
  active: boolean
}

function rowToItem(row: TopicRow): TopicItem {
  return {
    id: row.id,
    bank: row.bank,
    title: row.title ?? undefined,
    prompt: row.prompt ?? undefined,
    claim: row.claim ?? undefined,
    backgroundBullets: row.background_bullets ?? undefined,
    keywords: row.keywords ?? undefined,
    tags: row.tags ?? [],
    difficulty: row.difficulty ?? undefined,
    source: row.source,
    fetchedAt: new Date(row.fetched_at).getTime(),
  }
}

export async function ensureSeedTopics(): Promise<void> {
  const count = await db.topicItems.count()
  if (count > 0) return
  await db.topicItems.bulkAdd(buildSeedTopics())
  await setMeta('topicBankFetchedAt', 0)
}

export async function getBank(bank: TopicBank): Promise<TopicItem[]> {
  return db.topicItems.where('bank').equals(bank).toArray()
}

export async function topicBankMeta(): Promise<{
  explanation: number
  proposition: number
  fetchedAt: number
}> {
  const [explanation, proposition, fetchedAt] = await Promise.all([
    db.topicItems.where('bank').equals('explanation').count(),
    db.topicItems.where('bank').equals('proposition').count(),
    getMeta<number>('topicBankFetchedAt', 0),
  ])
  return { explanation, proposition, fetchedAt }
}

export async function pullTopicItemsFromSupabase(): Promise<{
  ok: boolean
  message: string
  counts?: { explanation: number; proposition: number }
}> {
  if (!supabase) {
    return { ok: false, message: 'Supabase가 설정되지 않았습니다. 저장된 시드 주제를 씁니다.' }
  }
  if (!isOnline()) {
    return { ok: false, message: '온라인일 때 할 수 있습니다. 지금은 저장된 주제로 연습할 수 있어요.' }
  }

  const { data, error } = await supabase
    .from('topic_items')
    .select(
      'id, bank, title, prompt, claim, background_bullets, keywords, tags, difficulty, source, fetched_at, active',
    )
    .eq('active', true)

  if (error) {
    return { ok: false, message: `주제를 가져오지 못했습니다: ${error.message}` }
  }

  const rows = (data ?? []) as TopicRow[]
  if (rows.length === 0) {
    return { ok: false, message: '서버 주제 은행이 비어 있습니다. 시드를 유지합니다.' }
  }

  const items = rows.map(rowToItem)
  const existing = await db.topicItems.toArray()
  const merged = new Map(existing.map((item) => [item.id, item]))
  for (const item of items) merged.set(item.id, item)
  await db.transaction('rw', db.topicItems, db.meta, async () => {
    await db.topicItems.clear()
    await db.topicItems.bulkAdd([...merged.values()])
    await setMeta('topicBankFetchedAt', Date.now())
  })

  const explanation = items.filter((i) => i.bank === 'explanation').length
  const proposition = items.filter((i) => i.bank === 'proposition').length
  return {
    ok: true,
    message: `설명 ${explanation}개, 논제 ${proposition}개를 저장했습니다.`,
    counts: { explanation, proposition },
  }
}

export async function refreshTopics(): Promise<{
  ok: boolean
  message: string
}> {
  if (!supabase) {
    return { ok: false, message: 'Supabase가 설정되지 않았습니다.' }
  }
  if (!isOnline()) {
    return { ok: false, message: '온라인일 때 할 수 있습니다. 지금은 저장된 주제로 연습할 수 있어요.' }
  }

  const { error: fnError } = await supabase.functions.invoke('refresh-topics', {
    method: 'POST',
  })
  if (fnError) {
    const pulled = await pullTopicItemsFromSupabase()
    if (pulled.ok) return pulled
    return { ok: false, message: `갱신 함수 호출 실패: ${fnError.message}` }
  }
  return pullTopicItemsFromSupabase()
}

export async function maybeRefreshTopics(): Promise<void> {
  if (!supabase || !isOnline()) return
  const fetchedAt = await getMeta<number>('topicBankFetchedAt', 0)
  if (Date.now() - fetchedAt < STALE_MS && fetchedAt > 0) return
  await refreshTopics()
}

export function customTopic(bank: TopicBank, text: string): TopicItem {
  const trimmed = text.trim()
  return {
    id: `custom-${crypto.randomUUID()}`,
    bank,
    title: bank === 'explanation' ? trimmed : undefined,
    prompt: bank === 'explanation' ? '이 주제를 처음 듣는 사람에게 설명하세요.' : undefined,
    claim: bank === 'proposition' ? trimmed : undefined,
    tags: ['직접 입력'],
    source: 'custom',
    fetchedAt: Date.now(),
  }
}
