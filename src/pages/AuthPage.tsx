import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useApp } from '../context/AppContext'

export function AuthPage() {
  const { online, setNotice } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(kind: 'signin' | 'signup' | 'magic') {
    if (!supabase) {
      setNotice('Supabase가 설정되지 않았습니다. 로컬 프로필로 연습하세요.')
      navigate('/')
      return
    }
    if (!online) {
      setNotice('온라인일 때 할 수 있습니다. 지금은 저장된 주제로 연습할 수 있어요.')
      return
    }
    setBusy(true)
    if (kind === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({ email })
      setNotice(error ? error.message : '로그인 링크를 이메일로 보냈습니다.')
    } else if (kind === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      setNotice(error ? error.message : '가입했습니다. 메일 확인이 필요할 수 있습니다.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setNotice(error ? error.message : '로그인했습니다.')
      if (!error) navigate('/')
    }
    setBusy(false)
  }

  return (
    <div className="card stack" style={{ maxWidth: 420, margin: '12vh auto' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>명료 연습실</h1>
      <p className="muted">설명하고, 논쟁하고, 토론한 뒤 글을 고칩니다.</p>
      {!supabaseConfigured && (
        <div className="notice">서버 키가 없습니다. 로컬만으로도 연습할 수 있습니다.</div>
      )}
      <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="btn primary" disabled={busy} type="button" onClick={() => void run('signin')}>
        로그인
      </button>
      <div className="row">
        <button className="btn" disabled={busy} type="button" onClick={() => void run('signup')}>
          가입
        </button>
        <button className="btn ghost" disabled={busy} type="button" onClick={() => void run('magic')}>
          매직 링크
        </button>
      </div>
      <button className="btn ghost" type="button" onClick={() => navigate('/')}>
        오프라인으로 시작
      </button>
    </div>
  )
}
