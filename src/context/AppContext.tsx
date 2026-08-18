import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { LocalProfile, NetworkChip, WritingLanguage } from '../types'
import { db, getMeta, setMeta } from '../lib/db'
import { createId, now } from '../lib/id'
import { isOnline, subscribeOnline } from '../lib/network'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  flushSyncQueue,
  mergeLocalIntoProfile,
  pullProfileData,
  pullProfiles,
  queuedCount,
  enqueueProfile,
} from '../lib/sync'
import { ensureSeedTopics, maybeRefreshTopics, topicBankMeta } from '../lib/topics'
import type { User } from '@supabase/supabase-js'

type TopicMeta = { explanation: number; proposition: number; fetchedAt: number }

type AppState = {
  ready: boolean
  user: User | null
  online: boolean
  chip: NetworkChip
  profiles: LocalProfile[]
  profile: LocalProfile | null
  topicMeta: TopicMeta
  queue: number
  supabaseConfigured: boolean
  notice: string | null
  setNotice: (msg: string | null) => void
  refreshAll: () => Promise<void>
  switchProfile: (id: string) => Promise<void>
  createProfile: (name: string) => Promise<{ ok: boolean; message: string }>
  renameProfile: (id: string, name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<{ ok: boolean; message: string }>
  updateProfileSettings: (patch: Partial<Pick<LocalProfile, 'editorFontSize' | 'lastWritingLanguage' | 'accent'>>) => Promise<void>
  signOut: (keepLocal: boolean) => Promise<void>
}

const ACCENTS = ['ink', 'pine', 'clay', 'plum']

const AppContext = createContext<AppState | null>(null)

async function ensureLocalProfile(): Promise<LocalProfile> {
  const existing = await db.profiles.where('userId').equals('local').first()
  if (existing) return existing
  const profile: LocalProfile = {
    id: createId(),
    userId: 'local',
    displayName: '로컬',
    accent: 'ink',
    editorFontSize: 18,
    lastWritingLanguage: 'ko',
    createdAt: now(),
    updatedAt: now(),
    isLocalOnly: true,
  }
  await db.profiles.put(profile)
  return profile
}

const NOTICE_MS = 3200

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [online, setOnline] = useState(isOnline())
  const [syncing, setSyncing] = useState(false)
  const [profiles, setProfiles] = useState<LocalProfile[]>([])
  const [profile, setProfile] = useState<LocalProfile | null>(null)
  const [topicMeta, setTopicMeta] = useState<TopicMeta>({
    explanation: 0,
    proposition: 0,
    fetchedAt: 0,
  })
  const [queue, setQueue] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const userRef = useRef(user)
  userRef.current = user
  const refreshGen = useRef(0)

  const loadMeta = useCallback(async () => {
    setTopicMeta(await topicBankMeta())
    const uid = userRef.current?.id
    setQueue(uid ? await queuedCount(uid) : 0)
  }, [])

  const activateProfile = useCallback(async (next: LocalProfile) => {
    setProfile(next)
    await setMeta('activeProfileId', next.id)
    if (online && userRef.current) await pullProfileData(next.id)
  }, [online])

  const refreshAll = useCallback(async () => {
    const gen = ++refreshGen.current
    const uid = userRef.current?.id ?? 'local'
    let list =
      uid === 'local'
        ? await db.profiles.where('userId').equals('local').toArray()
        : await pullProfiles(uid)

    if (uid !== 'local' && list.length === 0 && online && supabase && userRef.current) {
      const created: LocalProfile = {
        id: createId(),
        userId: userRef.current.id,
        displayName: '기본',
        accent: 'ink',
        editorFontSize: 18,
        lastWritingLanguage: 'ko',
        createdAt: now(),
        updatedAt: now(),
      }
      await db.profiles.put(created)
      await enqueueProfile(created)
      await supabase.from('profiles').upsert({
        id: created.id,
        user_id: created.userId,
        display_name: created.displayName,
        accent: created.accent,
        editor_font_size: created.editorFontSize,
        last_writing_language: created.lastWritingLanguage,
        created_at: new Date(created.createdAt).toISOString(),
        updated_at: new Date(created.updatedAt).toISOString(),
      })
      const localOnly = await db.profiles.where('userId').equals('local').first()
      if (localOnly) await mergeLocalIntoProfile(localOnly, created)
      list = [created]
    }

    if (gen !== refreshGen.current) return
    setProfiles(list)
    const savedId = await getMeta<string | null>('activeProfileId', null)
    const current =
      list.find((p) => p.id === savedId) ??
      list[0] ??
      (await ensureLocalProfile())
    if (gen !== refreshGen.current) return
    if (current) await activateProfile(current)
    if (gen === refreshGen.current) await loadMeta()
  }, [activateProfile, loadMeta, online])

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      await ensureSeedTopics()
      const local = await ensureLocalProfile()
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        setUser(data.session?.user ?? null)
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null)
        })
        unsub = () => sub.subscription.unsubscribe()
      } else {
        setProfile(local)
        setProfiles([local])
        await setMeta('activeProfileId', local.id)
      }
      setTopicMeta(await topicBankMeta())
      setQueue(await queuedCount())
      setReady(true)
    })()
    return () => unsub()
  }, [])

  useEffect(() => {
    return subscribeOnline((next) => setOnline(next))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!ready) return
    void refreshAll()
  }, [ready, user, refreshAll])

  useEffect(() => {
    if (!ready || !online || !user) {
      setSyncing(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setSyncing(true)
      await maybeRefreshTopics()
      await flushSyncQueue()
      if (!cancelled) {
        await loadMeta()
        setSyncing(false)
      }
    })()
    return () => {
      cancelled = true
      setSyncing(false)
    }
  }, [ready, online, user, loadMeta])

  const chip: NetworkChip = useMemo(() => {
    if (syncing) return 'syncing'
    if (!online) return queue > 0 && user ? 'queued' : 'offline'
    if (queue > 0 && user) return 'queued'
    return 'online'
  }, [online, queue, syncing, user])

  const switchProfile = useCallback(
    async (id: string) => {
      const next = profiles.find((p) => p.id === id) ?? (await db.profiles.get(id))
      if (next) await activateProfile(next)
    },
    [activateProfile, profiles],
  )

  const createProfile = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, message: '이름을 입력하세요.' }
      if (!online || !user || !supabase) {
        return { ok: false, message: '온라인일 때 할 수 있습니다. 지금은 저장된 주제로 연습할 수 있어요.' }
      }
      const row: LocalProfile = {
        id: createId(),
        userId: user.id,
        displayName: trimmed,
        accent: ACCENTS[profiles.length % ACCENTS.length] ?? 'ink',
        editorFontSize: 18,
        lastWritingLanguage: 'ko',
        createdAt: now(),
        updatedAt: now(),
      }
      await db.profiles.put(row)
      await enqueueProfile(row)
      const { error } = await supabase.from('profiles').upsert({
        id: row.id,
        user_id: row.userId,
        display_name: row.displayName,
        accent: row.accent,
        editor_font_size: row.editorFontSize,
        last_writing_language: row.lastWritingLanguage,
        created_at: new Date(row.createdAt).toISOString(),
        updated_at: new Date(row.updatedAt).toISOString(),
      })
      if (error) return { ok: false, message: error.message }
      await activateProfile(row)
      await refreshAll()
      return { ok: true, message: '프로필을 만들었습니다.' }
    },
    [activateProfile, online, profiles.length, refreshAll, user],
  )

  const renameProfile = useCallback(
    async (id: string, name: string) => {
      const current = await db.profiles.get(id)
      if (!current) return
      const next = { ...current, displayName: name.trim(), updatedAt: now() }
      await db.profiles.put(next)
      await enqueueProfile(next)
      if (profile?.id === id) setProfile(next)
      await refreshAll()
    },
    [profile?.id, refreshAll],
  )

  const deleteProfile = useCallback(
    async (id: string) => {
      if (!online || !supabase) {
        return { ok: false, message: '온라인일 때 할 수 있습니다.' }
      }
      if (profiles.length <= 1) {
        return { ok: false, message: '마지막 프로필은 지울 수 없습니다. 이름을 바꿔 주세요.' }
      }
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) return { ok: false, message: error.message }
      const sessions = await db.sessions.where('profileId').equals(id).toArray()
      const sessionIds = sessions.map((s) => s.id)
      await db.documents.where('sessionId').anyOf(sessionIds).delete()
      await db.sessions.where('profileId').equals(id).delete()
      await db.profiles.delete(id)
      const remaining = profiles.filter((p) => p.id !== id)
      if (remaining[0]) await activateProfile(remaining[0])
      await refreshAll()
      return { ok: true, message: '프로필을 삭제했습니다.' }
    },
    [activateProfile, online, profiles, refreshAll],
  )

  const updateProfileSettings = useCallback(
    async (patch: Partial<Pick<LocalProfile, 'editorFontSize' | 'lastWritingLanguage' | 'accent'>>) => {
      if (!profile) return
      const next = { ...profile, ...patch, updatedAt: now() }
      await db.profiles.put(next)
      setProfile(next)
      await enqueueProfile(next)
    },
    [profile],
  )

  const signOut = useCallback(
    async (keepLocal: boolean) => {
      if (!keepLocal && online) {
        await flushSyncQueue()
      }
      refreshGen.current += 1
      userRef.current = null
      await supabase?.auth.signOut()
      setUser(null)
      const local = await ensureLocalProfile()
      setProfile(local)
      await setMeta('activeProfileId', local.id)
      const locals = await db.profiles.where('userId').equals('local').toArray()
      setProfiles(locals.length > 0 ? locals : [local])
      await loadMeta()
    },
    [loadMeta, online],
  )

  const value: AppState = {
    ready,
    user,
    online,
    chip,
    profiles,
    profile,
    topicMeta,
    queue,
    supabaseConfigured,
    notice,
    setNotice,
    refreshAll,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    updateProfileSettings,
    signOut,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function useWritingLanguage(): WritingLanguage {
  return useApp().profile?.lastWritingLanguage ?? 'ko'
}
