import type {
  DocRole,
  LocalDocument,
  LocalSession,
  Mark,
  SessionType,
  Stance,
  TopicSnapshot,
  WritingLanguage,
} from '../types'
import { db } from './db'
import { createId, now } from './id'
import { enqueueDocument, enqueueSession } from './sync'
import { daysFrom } from './time'

export const STEPS: Record<SessionType, string[]> = {
  explanation: ['draw', 'research', 'write', 'feedback', 'revise', 'done'],
  argument: ['draw', 'stance', 'write', 'feedback', 'revise', 'done'],
  debate: ['draw', 'research', 'debate', 'summary', 'feedback', 'done'],
}

export const STEP_LABELS: Record<string, string> = {
  draw: '주제 추첨',
  research: '조사',
  write: '글쓰기',
  stance: '입장',
  feedback: '피드백',
  revise: '고쳐쓰기',
  debate: '외부 토론',
  summary: '요약',
  done: '완료',
}

export const STEP_MS: Record<string, number> = {
  research: 15 * 60 * 1000,
  writeExplanation: 10 * 60 * 1000,
  writeArgument: 40 * 60 * 1000,
  debateResearch: 20 * 60 * 1000,
}

export function topicSnapshotFromItem(item: {
  id: string
  title?: string
  prompt?: string
  claim?: string
  backgroundBullets?: string[]
  keywords?: string[]
  source: string
}): TopicSnapshot {
  return {
    id: item.id,
    title: item.title ?? item.claim ?? '제목 없음',
    prompt: item.prompt,
    claim: item.claim,
    backgroundBullets: item.backgroundBullets,
    keywords: item.keywords,
    source: item.source,
  }
}

export async function createSession(input: {
  profileId: string
  userId: string
  type: SessionType
  topic: TopicSnapshot
  language: WritingLanguage
}): Promise<LocalSession> {
  const t = now()
  const session: LocalSession = {
    id: createId(),
    profileId: input.profileId,
    userId: input.userId,
    type: input.type,
    status: 'in_progress',
    step: STEPS[input.type][1] ?? 'research',
    topic: input.topic,
    language: input.language,
    durations: {},
    stepStartedAt: t,
    dueRevisions: [],
    createdAt: t,
    updatedAt: t,
    syncState: input.userId === 'local' ? 'local' : 'pending',
  }
  await db.sessions.put(session)
  await enqueueSession(session)
  return session
}

export async function touchSession(
  session: LocalSession,
  patch: Partial<LocalSession>,
): Promise<LocalSession> {
  const next: LocalSession = { ...session, ...patch, updatedAt: now() }
  if (next.userId !== 'local' && next.syncState !== 'local') next.syncState = 'pending'
  await db.sessions.put(next)
  await enqueueSession(next)
  return next
}

export async function advanceStep(session: LocalSession, nextStep: string): Promise<LocalSession> {
  const elapsed = now() - session.stepStartedAt
  const durations = { ...session.durations, [session.step]: (session.durations[session.step] ?? 0) + elapsed }
  const done = nextStep === 'done'
  let dueRevisions = session.dueRevisions
  if (done && (session.type === 'explanation' || session.type === 'argument') && dueRevisions.length === 0) {
    const base = now()
    dueRevisions = [
      { at: daysFrom(base, 2), kind: 'd2', done: false },
      { at: daysFrom(base, 10), kind: 'd10', done: false },
    ]
  }
  return touchSession(session, {
    step: nextStep,
    stepStartedAt: now(),
    durations,
    status: done ? (dueRevisions.some((r) => !r.done) ? 'revision_pending' : 'complete') : 'in_progress',
    dueRevisions,
  })
}

export async function upsertDocument(input: {
  session: LocalSession
  role: DocRole
  version: number
  text: string
  marks?: Mark[]
}): Promise<LocalDocument> {
  const existing = await db.documents
    .where('sessionId')
    .equals(input.session.id)
    .filter((d) => d.role === input.role && d.version === input.version)
    .first()
  const doc: LocalDocument = existing
    ? { ...existing, text: input.text, marks: input.marks, createdAt: existing.createdAt }
    : {
        id: createId(),
        sessionId: input.session.id,
        userId: input.session.userId,
        role: input.role,
        version: input.version,
        text: input.text,
        marks: input.marks,
        createdAt: now(),
      }
  await db.documents.put(doc)
  await enqueueDocument(doc)
  return doc
}

export async function latestDocument(
  sessionId: string,
  role: DocRole,
): Promise<LocalDocument | undefined> {
  const all = await db.documents.where('sessionId').equals(sessionId).toArray()
  return all
    .filter((d) => d.role === role)
    .sort((a, b) => b.version - a.version || b.createdAt - a.createdAt)[0]
}

export async function latestVersionNumber(sessionId: string): Promise<number> {
  const all = await db.documents.where('sessionId').equals(sessionId).toArray()
  if (all.length === 0) return 1
  return Math.max(...all.map((d) => d.version))
}

export async function startRevision(session: LocalSession): Promise<LocalSession> {
  const version = (await latestVersionNumber(session.id)) + 1
  const base =
    (await latestDocument(session.id, 'clean')) ?? (await latestDocument(session.id, 'draft'))
  if (base) {
    await upsertDocument({
      session,
      role: 'draft',
      version,
      text: base.text,
    })
  }
  return touchSession(session, {
    step: 'feedback',
    status: 'in_progress',
    stepStartedAt: now(),
  })
}

export function nextStep(type: SessionType, current: string): string {
  const list = STEPS[type]
  const i = list.indexOf(current)
  return list[Math.min(i + 1, list.length - 1)] ?? 'done'
}

export function typeLabel(type: SessionType): string {
  if (type === 'explanation') return '설명하기'
  if (type === 'argument') return '논쟁하기'
  return '토론하기'
}

export function stanceLabel(side: Stance['side']): string {
  if (side === 'for') return '찬성'
  if (side === 'against') return '반대'
  return '조건부 찬성'
}
