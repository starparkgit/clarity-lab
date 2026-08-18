import type { LocalDocument, LocalProfile, LocalSession, TopicItem } from '../types'
import { db } from './db'
import { now } from './id'

export type BackupFile = {
  version: 1
  exportedAt: number
  profiles: LocalProfile[]
  sessions: LocalSession[]
  documents: LocalDocument[]
  topicItems?: TopicItem[]
}

export async function exportBackup(profileIds?: string[]): Promise<BackupFile> {
  const profiles = profileIds
    ? await db.profiles.bulkGet(profileIds).then((rows) => rows.filter(Boolean) as LocalProfile[])
    : await db.profiles.toArray()
  const ids = new Set(profiles.map((p) => p.id))
  const sessions = (await db.sessions.toArray()).filter((s) => ids.has(s.profileId))
  const sessionIds = new Set(sessions.map((s) => s.id))
  const documents = (await db.documents.toArray()).filter((d) => sessionIds.has(d.sessionId))
  return {
    version: 1,
    exportedAt: now(),
    profiles,
    sessions,
    documents,
  }
}

export async function importBackup(
  backup: BackupFile,
  mode: 'merge-current' | 'add-profiles',
  currentProfileId?: string,
): Promise<void> {
  if (mode === 'merge-current' && currentProfileId) {
    const current = await db.profiles.get(currentProfileId)
    if (!current) return
    for (const session of backup.sessions) {
      const next = {
        ...session,
        profileId: current.id,
        userId: current.userId,
        updatedAt: now(),
        syncState: 'pending' as const,
      }
      await db.sessions.put(next)
    }
    await db.documents.bulkPut(backup.documents)
    return
  }
  await db.profiles.bulkPut(backup.profiles)
  await db.sessions.bulkPut(backup.sessions)
  await db.documents.bulkPut(backup.documents)
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
