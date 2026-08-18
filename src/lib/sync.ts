import type { LocalDocument, LocalProfile, LocalSession } from '../types'
import { db, getMeta, setMeta } from './db'
import { createId, now } from './id'
import { isOnline } from './network'
import { supabase } from './supabase'

type QueueTable = 'profiles' | 'sessions' | 'documents'

function profileRow(p: LocalProfile) {
  return {
    id: p.id,
    user_id: p.userId,
    display_name: p.displayName,
    accent: p.accent,
    editor_font_size: p.editorFontSize,
    last_writing_language: p.lastWritingLanguage,
    created_at: new Date(p.createdAt).toISOString(),
    updated_at: new Date(p.updatedAt).toISOString(),
  }
}

function sessionRow(s: LocalSession) {
  return {
    id: s.id,
    profile_id: s.profileId,
    user_id: s.userId,
    type: s.type,
    status: s.status,
    step: s.step,
    topic: s.topic,
    language: s.language,
    stance: s.stance ?? null,
    durations: s.durations,
    step_started_at: new Date(s.stepStartedAt).toISOString(),
    due_revisions: s.dueRevisions,
    created_at: new Date(s.createdAt).toISOString(),
    updated_at: new Date(s.updatedAt).toISOString(),
  }
}

function documentRow(d: LocalDocument) {
  return {
    id: d.id,
    session_id: d.sessionId,
    user_id: d.userId,
    role: d.role,
    version: d.version,
    text: d.text,
    marks: d.marks ?? null,
    created_at: new Date(d.createdAt).toISOString(),
  }
}

export async function enqueue(
  table: QueueTable,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.syncQueue.put({
    id: createId(),
    table,
    payload,
    updatedAt: now(),
    tries: 0,
  })
}

export async function enqueueProfile(p: LocalProfile): Promise<void> {
  if (p.isLocalOnly) return
  await enqueue('profiles', profileRow(p))
}

export async function enqueueSession(s: LocalSession): Promise<void> {
  if (s.userId === 'local') return
  await db.sessions.update(s.id, { syncState: 'pending' })
  await enqueue('sessions', sessionRow({ ...s, syncState: 'pending' }))
}

export async function enqueueDocument(d: LocalDocument): Promise<void> {
  if (d.userId === 'local') return
  await enqueue('documents', documentRow(d))
}

export async function queuedCount(): Promise<number> {
  return db.syncQueue.count()
}

export async function flushSyncQueue(): Promise<{ ok: boolean; remaining: number }> {
  if (!supabase || !isOnline()) {
    return { ok: false, remaining: await queuedCount() }
  }

  const items = await db.syncQueue.orderBy('updatedAt').toArray()
  for (const item of items) {
    const table =
      item.table === 'profiles' ? 'profiles' : item.table === 'sessions' ? 'sessions' : 'documents'
    const { error } = await supabase.from(table).upsert(item.payload)
    if (error) {
      await db.syncQueue.update(item.id, { tries: item.tries + 1 })
      continue
    }
    await db.syncQueue.delete(item.id)
    if (item.table === 'sessions' && typeof item.payload.id === 'string') {
      await db.sessions.update(item.payload.id, { syncState: 'synced' })
    }
  }
  return { ok: true, remaining: await queuedCount() }
}

type RemoteProfile = {
  id: string
  user_id: string
  display_name: string
  accent: string | null
  editor_font_size: number | null
  last_writing_language: 'ko' | 'en' | null
  created_at: string
  updated_at: string
}

type RemoteSession = {
  id: string
  profile_id: string
  user_id: string
  type: LocalSession['type']
  status: LocalSession['status']
  step: string
  topic: LocalSession['topic']
  language: LocalSession['language']
  stance: LocalSession['stance'] | null
  durations: Record<string, number>
  step_started_at: string
  due_revisions: LocalSession['dueRevisions']
  created_at: string
  updated_at: string
}

type RemoteDocument = {
  id: string
  session_id: string
  user_id: string
  role: LocalDocument['role']
  version: number
  text: string
  marks: LocalDocument['marks'] | null
  created_at: string
}

function toLocalProfile(row: RemoteProfile): LocalProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    accent: row.accent ?? 'ink',
    editorFontSize: row.editor_font_size ?? 18,
    lastWritingLanguage: row.last_writing_language ?? 'ko',
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function toLocalSession(row: RemoteSession): LocalSession {
  return {
    id: row.id,
    profileId: row.profile_id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    step: row.step,
    topic: row.topic,
    language: row.language,
    stance: row.stance ?? undefined,
    durations: row.durations ?? {},
    stepStartedAt: new Date(row.step_started_at).getTime(),
    dueRevisions: row.due_revisions ?? [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    syncState: 'synced',
  }
}

function toLocalDocument(row: RemoteDocument): LocalDocument {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    version: row.version,
    text: row.text,
    marks: row.marks ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  }
}

export async function pullProfileData(profileId: string): Promise<void> {
  if (!supabase || !isOnline()) return
  const lastPulled = await getMeta<number>(`lastPulled:${profileId}`, 0)
  const since = new Date(lastPulled).toISOString()

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('profile_id', profileId)
    .gt('updated_at', since)
  if (sErr) return

  const remoteSessions = (sessions ?? []) as RemoteSession[]
  for (const row of remoteSessions) {
    const local = await db.sessions.get(row.id)
    const incoming = toLocalSession(row)
    if (!local || incoming.updatedAt >= local.updatedAt) {
      await db.sessions.put(incoming)
    }
  }

  const sessionIds = (await db.sessions.where('profileId').equals(profileId).toArray()).map(
    (s) => s.id,
  )
  if (sessionIds.length > 0) {
    const { data: docs } = await supabase.from('documents').select('*').in('session_id', sessionIds)
    for (const row of (docs ?? []) as RemoteDocument[]) {
      const existing = await db.documents.get(row.id)
      if (!existing) await db.documents.put(toLocalDocument(row))
    }
  }

  await setMeta(`lastPulled:${profileId}`, Date.now())
}

export async function pullProfiles(userId: string): Promise<LocalProfile[]> {
  if (!supabase || !isOnline()) {
    return db.profiles.where('userId').equals(userId).toArray()
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId)
  if (error || !data) {
    return db.profiles.where('userId').equals(userId).toArray()
  }
  const remotes = (data as RemoteProfile[]).map(toLocalProfile)
  await db.transaction('rw', db.profiles, async () => {
    for (const p of remotes) {
      await db.profiles.put(p)
    }
  })
  return remotes
}

export async function mergeLocalIntoProfile(
  localProfile: LocalProfile,
  target: LocalProfile,
): Promise<void> {
  const sessions = await db.sessions.where('profileId').equals(localProfile.id).toArray()
  for (const session of sessions) {
    const next: LocalSession = {
      ...session,
      profileId: target.id,
      userId: target.userId,
      updatedAt: now(),
      syncState: 'pending',
    }
    await db.sessions.put(next)
    await enqueueSession(next)
    const docs = await db.documents.where('sessionId').equals(session.id).toArray()
    for (const doc of docs) {
      const moved: LocalDocument = { ...doc, userId: target.userId }
      await db.documents.put(moved)
      await enqueueDocument(moved)
    }
  }
  await db.profiles.delete(localProfile.id)
}
