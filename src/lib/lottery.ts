import type { TopicBank, TopicItem } from '../types'
import { db } from './db'
import { now } from './id'

const AVOID = 12

export async function drawTopic(
  profileId: string,
  bank: TopicBank,
): Promise<TopicItem | null> {
  const items = await db.topicItems.where('bank').equals(bank).toArray()
  if (items.length === 0) return null

  const historyId = `${profileId}:${bank}`
  const history = await db.rerollHistory.get(historyId)
  const recent = history?.ids ?? []
  const pool = items.filter((item) => !recent.includes(item.id))
  const pickFrom = pool.length > 0 ? pool : items
  const chosen = pickFrom[Math.floor(Math.random() * pickFrom.length)]
  if (!chosen) return null

  const nextIds = [...recent, chosen.id].slice(-AVOID)
  await db.rerollHistory.put({
    id: historyId,
    profileId,
    bank,
    ids: nextIds,
    updatedAt: now(),
  })
  return chosen
}

export async function resetRerollHistory(profileId?: string): Promise<void> {
  if (!profileId) {
    await db.rerollHistory.clear()
    return
  }
  await db.rerollHistory.where('profileId').equals(profileId).delete()
}
