import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { downloadJson, exportBackup, importBackup, type BackupFile } from '../lib/backup'
import { isOnline } from '../lib/network'
import { flushSyncQueue } from '../lib/sync'
import { refreshTopics } from '../lib/topics'
import { formatKoreanDate, formatRelative } from '../lib/time'

export function SettingsPage() {
  const {
    profile,
    user,
    topicMeta,
    queue,
    online,
    supabaseConfigured,
    updateProfileSettings,
    refreshAll,
    signOut,
    setNotice,
  } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)

  if (!profile) return null

  async function handleSignOut(keepLocal: boolean) {
    setLeaving(true)
    await signOut(keepLocal)
    navigate('/auth', { replace: true })
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1 className="topic-title">설정</h1>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>주제 은행</h3>
        <p className="muted">
          설명 {topicMeta.explanation}개 · 논제 {topicMeta.proposition}개 ·{' '}
          {topicMeta.fetchedAt ? `${formatRelative(topicMeta.fetchedAt)} 업데이트` : '시드(아직 서버에서 받지 않음)'}
        </p>
        <button
          className="btn primary"
          type="button"
          disabled={!online || busy || leaving}
          onClick={async () => {
            setBusy(true)
            const result = await refreshTopics()
            setNotice(result.message)
            await refreshAll()
            setBusy(false)
          }}
        >
          주제 새로 가져오기
        </button>
        {!online && <p className="muted">온라인일 때 할 수 있습니다. 지금은 저장된 주제로 연습할 수 있어요.</p>}
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>글꼴 크기</h3>
        <input
          type="range"
          min={16}
          max={24}
          value={profile.editorFontSize}
          disabled={leaving}
          onChange={(e) => {
            const next = Number(e.target.value)
            document.documentElement.style.setProperty('--editor-size', `${next}px`)
            void updateProfileSettings({ editorFontSize: next })
          }}
        />
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>백업</h3>
        <div className="row">
          <button
            className="btn"
            type="button"
            disabled={leaving}
            onClick={async () => {
              const data = await exportBackup([profile.id])
              downloadJson(`clarity-lab-${profile.displayName}.json`, data)
            }}
          >
            이 프로필 보내기
          </button>
          <label className="btn">
            가져오기
            <input
              type="file"
              accept="application/json"
              hidden
              disabled={leaving}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const parsed = JSON.parse(await file.text()) as BackupFile
                const mode =
                  isOnline() && window.confirm('새 프로필로 추가할까요? 취소를 누르면 현재 프로필에 합칩니다.')
                    ? 'add-profiles'
                    : 'merge-current'
                if (mode === 'add-profiles' && !isOnline()) {
                  setNotice('새 프로필 추가는 온라인일 때 할 수 있습니다.')
                  return
                }
                await importBackup(parsed, mode, profile.id)
                await refreshAll()
                setNotice('가져왔습니다.')
              }}
            />
          </label>
        </div>
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>동기화</h3>
        <p className="muted">대기 {queue}건</p>
        <button
          className="btn"
          type="button"
          disabled={!online || !user || leaving}
          onClick={async () => {
            const result = await flushSyncQueue()
            setNotice(result.remaining === 0 ? '동기화했습니다.' : `남은 대기 ${result.remaining}건`)
            await refreshAll()
          }}
        >
          지금 동기화
        </button>
        {!user && !leaving && <p className="muted">로그인하면 이 기기와 서버를 맞출 수 있습니다.</p>}
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>계정</h3>
        <p className="muted">
          {user?.email ?? (leaving ? '로그아웃 중…' : '로컬 프로필')}
          {!supabaseConfigured && ' · Supabase 미설정'}
        </p>
        {(user || leaving) && (
          <div className="row">
            <button
              className="btn"
              type="button"
              disabled={leaving}
              onClick={() => void handleSignOut(false)}
            >
              동기화 후 로그아웃
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={leaving}
              onClick={() => void handleSignOut(true)}
            >
              로컬에 남기고 로그아웃
            </button>
          </div>
        )}
        {!user && !leaving && (
          <button className="btn primary" type="button" onClick={() => navigate('/auth')}>
            로그인 / 가입
          </button>
        )}
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>앱 설치</h3>
        <p className="muted">
          브라우저 메뉴에서 “앱 설치” 또는 “홈 화면에 추가”를 고르면, 이후 오프라인에서도 연습할 수 있습니다. 주제
          은행은 온라인일 때 한 번 받아 두면 됩니다. 마지막 확인 {topicMeta.fetchedAt ? formatKoreanDate(topicMeta.fetchedAt) : '없음'}.
        </p>
      </section>
    </div>
  )
}
