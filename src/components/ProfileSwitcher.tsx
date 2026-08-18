import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function ProfileSwitcher() {
  const { profile, profiles, online, switchProfile, createProfile, renameProfile, deleteProfile, setNotice } =
    useApp()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [rename, setRename] = useState('')

  if (!profile) return null

  return (
    <>
      <button className="chip" type="button" onClick={() => setOpen(true)}>
        {profile.displayName}
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal stack" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0 }}>프로필</h3>
            <div className="list">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  className="item"
                  type="button"
                  onClick={async () => {
                    await switchProfile(p.id)
                    setOpen(false)
                  }}
                >
                  {p.displayName}
                  {p.id === profile.id ? ' · 사용 중' : ''}
                  {p.isLocalOnly ? ' · 로컬' : ''}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="새 프로필 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="btn primary"
              type="button"
              onClick={async () => {
                const result = await createProfile(name)
                setNotice(result.message)
                if (result.ok) {
                  setName('')
                  setOpen(false)
                }
              }}
            >
              프로필 만들기 {online ? '' : '(온라인 필요)'}
            </button>
            <input
              type="text"
              placeholder="현재 이름 바꾸기"
              value={rename}
              onChange={(e) => setRename(e.target.value)}
            />
            <div className="row">
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  if (rename.trim()) await renameProfile(profile.id, rename)
                  setRename('')
                }}
              >
                이름 변경
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={async () => {
                  const typed = window.prompt(`삭제하려면 이름 "${profile.displayName}"을 입력하세요.`)
                  if (typed !== profile.displayName) return
                  const result = await deleteProfile(profile.id)
                  setNotice(result.message)
                }}
              >
                삭제
              </button>
            </div>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
