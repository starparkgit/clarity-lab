import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ProfileSwitcher } from './ProfileSwitcher'
import { StatusChip } from './StatusChip'

export function Shell({ children }: { children: ReactNode }) {
  const { profile, chip, notice, setNotice } = useApp()
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--editor-size',
      `${profile?.editorFontSize ?? 18}px`,
    )
  }, [profile?.editorFontSize])
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <strong>명료 연습실</strong>
          <span>Clarity Lab</span>
        </Link>
        <nav className="topbar-nav">
          <NavLink to="/archive" className="btn ghost">
            기록
          </NavLink>
          <NavLink to="/revisions" className="btn ghost">
            고쳐쓰기
          </NavLink>
          <NavLink to="/settings" className="btn ghost">
            설정
          </NavLink>
          <ProfileSwitcher />
          <StatusChip chip={chip} />
        </nav>
      </header>
      {notice && (
        <div className="notice" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {children}
    </div>
  )
}
