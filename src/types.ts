export const SESSION_TYPES = ['explanation', 'argument', 'debate'] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const SESSION_STATUSES = [
  'in_progress',
  'complete',
  'revision_pending',
] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export const WRITING_LANGUAGES = ['ko', 'en'] as const
export type WritingLanguage = (typeof WRITING_LANGUAGES)[number]

export const STANCE_SIDES = ['for', 'against', 'conditional'] as const
export type StanceSide = (typeof STANCE_SIDES)[number]

export const MARK_TYPES = [
  'space',
  'join',
  'insert',
  'replace',
  'punct',
  'delete',
  'transpose',
  'break',
  'joinLine',
] as const
export type MarkType = (typeof MARK_TYPES)[number]

export const DOC_ROLES = [
  'researchNotes',
  'draft',
  'feedback',
  'annotated',
  'clean',
  'debateSummary',
  'stanceCards',
] as const
export type DocRole = (typeof DOC_ROLES)[number]

export const BANKS = ['explanation', 'proposition'] as const
export type TopicBank = (typeof BANKS)[number]

export const SYNC_STATES = ['local', 'pending', 'synced', 'error'] as const
export type SyncState = (typeof SYNC_STATES)[number]

export type TopicItem = {
  id: string
  bank: TopicBank
  title?: string
  prompt?: string
  claim?: string
  backgroundBullets?: string[]
  keywords?: string[]
  tags: string[]
  difficulty?: string
  source: 'seed' | 'curated' | 'trend-refresh' | 'custom'
  fetchedAt: number
}

export type TopicSnapshot = {
  id: string
  title: string
  prompt?: string
  claim?: string
  backgroundBullets?: string[]
  keywords?: string[]
  source: string
}

export type ReasonSlot = {
  reason: string
  support: string
}

export type Stance = {
  side: StanceSide
  reasons: ReasonSlot[]
}

export type DueRevision = {
  at: number
  kind: 'd2' | 'd10'
  done: boolean
}

export type Mark = {
  id: string
  type: MarkType
  start: number
  end: number
  /** Second range for 자리바꿈 (two drags). */
  start2?: number
  end2?: number
  replacement?: string
  accepted: boolean
}

export type LocalProfile = {
  id: string
  userId: string
  displayName: string
  accent: string
  editorFontSize: number
  lastWritingLanguage: WritingLanguage
  createdAt: number
  updatedAt: number
  isLocalOnly?: boolean
}

export type LocalSession = {
  id: string
  profileId: string
  userId: string
  type: SessionType
  status: SessionStatus
  step: string
  topic: TopicSnapshot
  language: WritingLanguage
  stance?: Stance
  durations: Record<string, number>
  stepStartedAt: number
  dueRevisions: DueRevision[]
  createdAt: number
  updatedAt: number
  syncState: SyncState
}

export type LocalDocument = {
  id: string
  sessionId: string
  userId: string
  role: DocRole
  version: number
  text: string
  marks?: Mark[]
  createdAt: number
}

export type SyncQueueItem = {
  id: string
  table: 'profiles' | 'sessions' | 'documents'
  payload: Record<string, unknown>
  updatedAt: number
  tries: number
}

export type NetworkChip = 'online' | 'offline' | 'syncing' | 'queued'

export type DebateChecklist = {
  started: boolean
  threeTurns: boolean
  ended: boolean
}
