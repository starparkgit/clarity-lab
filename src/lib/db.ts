import Dexie, { type EntityTable } from 'dexie'
import type {
  LocalDocument,
  LocalProfile,
  LocalSession,
  SyncQueueItem,
  TopicItem,
} from '../types'

export type MetaRow = {
  key: string
  value: unknown
}

export class ClarityDB extends Dexie {
  profiles!: EntityTable<LocalProfile, 'id'>
  sessions!: EntityTable<LocalSession, 'id'>
  documents!: EntityTable<LocalDocument, 'id'>
  topicItems!: EntityTable<TopicItem, 'id'>
  meta!: EntityTable<MetaRow, 'key'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  rerollHistory!: EntityTable<
    { id: string; profileId: string; bank: string; ids: string[]; updatedAt: number },
    'id'
  >

  constructor() {
    super('clarity-lab')
    this.version(1).stores({
      profiles: 'id, userId, updatedAt',
      sessions: 'id, profileId, userId, type, status, updatedAt, createdAt',
      documents: 'id, sessionId, userId, role, version, createdAt',
      topicItems: 'id, bank, source, fetchedAt',
      meta: 'key',
      syncQueue: 'id, table, updatedAt',
      rerollHistory: 'id, profileId, bank',
    })
  }
}

export const db = new ClarityDB()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return (row?.value as T | undefined) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
