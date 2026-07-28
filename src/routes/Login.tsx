import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authRedirectTo, supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/AuthLayout'
import { Callout } from '@/components/ui/Callout'
import { Button } from '@/components/ui/Button'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { isEmailNotConfirmed } from '@/auth/authErrors'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [notice, setNotice] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setUnconfirmed(false)
    setBusy(true)

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)

    if (!error) {
      navigate(from, { replace: true })
      return
    }

    // 미인증 계정만 예외적으로 구분한다.
    // 통일해 버리면 비밀번호가 맞는데도 계속 틀렸다고 나와서 영영 못 들어간다.
    if (isEmailNotConfirmed(error)) {
      setUnconfirmed(true)
      return
    }
    setError('이메일 또는 비밀번호가 올바르지 않습니다')
  }

  async function resendConfirmation() {
    setBusy(true)
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authRedirectTo('/') },
    })
    setBusy(false)
    setUnconfirmed(false)
    setNotice('인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.')
  }

  return (
    <AuthLayout
      title="로그인"
      footer={
        <span className="text-ink-2">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="font-medium text-ink underline">
            회원가입
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="비밀번호"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Callout tone="error">{error}</Callout>
        <Callout>{notice}</Callout>

        {unconfirmed && (
          <div className="space-y-2 rounded-control bg-surface-3 px-3 py-3">
            <p className="text-label text-ink-2">이메일 인증이 필요합니다.</p>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={busy}
              className="text-label font-medium text-ink-2 underline disabled:opacity-50"
            >
              인증 메일 다시 받기
            </button>
          </div>
        )}

        <Button type="submit" loading={busy}>
          로그인
        </Button>
      </form>

      <p className="mt-4 text-center">
        <Link to="/forgot-password" className="text-label text-ink-muted hover:text-ink">
          비밀번호를 잊으셨나요?
        </Link>
      </p>
    </AuthLayout>
  )
}
