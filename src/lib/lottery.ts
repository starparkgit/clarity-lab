import type { TopicBank, TopicItem } from '../types'
import { db } from './db'

export async function drawTopic(
  profileId: string,
  bank: TopicBank,
): Promise<TopicItem | null> {
  const items = await db.topicItems.where('bank').equals(bank).toArray()
  if (items.length === 0) return null

  const sessions = await db.sessions.where('profileId').equals(profileId).toArray()
  const usedIds = new Set(
    sessions.map((session) => session.topic.id).filter((id): id is string => Boolean(id)),
  )
  const pool = items.filter((item) => !usedIds.has(item.id))
  const pickFrom = pool.length > 0 ? pool : items
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? null
}
