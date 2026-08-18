import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useApp } from '../context/AppContext'

function loginErrorMessage(message: string, code?: string): string {
  const text = message.toLowerCase()
  if (
    code === 'invalid_credentials' ||
    text.includes('invalid login credentials') ||
    text.includes('invalid_credentials')
  ) {
    return '이메일이 없거나 비밀번호가 올바르지 않습니다.'
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return '이메일 인증이 아직 끝나지 않았습니다. 받은 편지함을 확인해 주세요.'
  }
  if (code === 'user_already_exists' || text.includes('already registered') || text.includes('already been registered')) {
    return '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 확인해 주세요.'
  }
  if (code === 'weak_password' || text.includes('password')) {
    if (text.includes('weak') || text.includes('least')) return '비밀번호가 너무 짧습니다. 더 길게 입력해 주세요.'
  }
  return message
}

export function AuthPage() {
  const { online, user, notice, setNotice } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function run(kind: 'signin' | 'signup' | 'magic') {
    setError(null)
    if (!supabase) {
      setNotice('Supabase가 설정되지 않았습니다. 로컬 프로필로 연습하세요.')
      navigate('/')
      return
    }
    if (!online) {
      setError('온라인일 때 할 수 있습니다. 지금은 저장된 주제로 연습할 수 있어요.')
      return
    }
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('이메일을 입력해 주세요.')
      return
    }
    if (kind !== 'magic' && !password) {
      setError('비밀번호를 입력해 주세요.')
      return
    }

    setBusy(true)
    if (kind === 'magic') {
      const { error: authError } = await supabase.auth.signInWithOtp({ email: trimmedEmail })
      if (authError) setError(loginErrorMessage(authError.message, authError.code))
      else setNotice('로그인 링크를 이메일로 보냈습니다.')
    } else if (kind === 'signup') {
      const { error: authError } = await supabase.auth.signUp({ email: trimmedEmail, password })
      if (authError) setError(loginErrorMessage(authError.message, authError.code))
      else setNotice('가입했습니다. 메일 확인이 필요할 수 있습니다.')
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })
      if (authError) {
        setError(loginErrorMessage(authError.message, authError.code))
      } else {
        setNotice('로그인했습니다.')
        navigate('/')
      }
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
      {error && <div className="notice warn">{error}</div>}
      {notice && !error && <div className="notice">{notice}</div>}
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (error) setError(null)
        }}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void run('signin')
        }}
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
