import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authRedirectTo, supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/AuthLayout'
import { Callout } from '@/components/ui/Callout'
import { Button } from '@/components/ui/Button'
import { PasswordField, TextField } from '@/components/ui/TextField'

const MIN_PASSWORD = 8

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  /** 가입 후 "메일을 확인해 주세요" 상태. 라우트를 늘리지 않고 같은 화면에서 전환한다. */
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedNickname = nickname.trim()
    if (password.length < MIN_PASSWORD) {
      setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`)
      return
    }
    if (trimmedNickname.length < 1 || trimmedNickname.length > 20) {
      setError('닉네임은 1~20자로 입력해 주세요')
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nickname: trimmedNickname },
        emailRedirectTo: authRedirectTo('/'),
      },
    })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    // 이미 가입된 이메일이어도 Supabase 는 성공처럼 응답한다(계정 열거 방지).
    // 응답으로는 구분하지 않고, 아래 "메일 확인" 화면의 안내 문구가 두 경우를 모두 커버한다.
    setSent(true)
  }

  async function resend() {
    setBusy(true)
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authRedirectTo('/') },
    })
    setBusy(false)
    setNotice('인증 메일을 다시 보냈습니다.')
  }

  if (sent) {
    return (
      <AuthLayout
        title="메일을 확인해 주세요"
        description={`${email} 로 인증 링크를 보냈습니다. 링크를 누르면 로그인됩니다.`}
      >
        <div className="space-y-4">
          <Callout>{notice}</Callout>

          <Button variant="ghost" onClick={resend} loading={busy}>
            메일이 오지 않았나요? 다시 보내기
          </Button>

          {/*
            가입 응답만으로는 "새 계정"과 "이미 있는 계정"을 구분할 수 없다.
            구분해서 알려주면 계정 열거가 열리므로, 대신 두 경우를 모두 커버하는
            안내로 막다른 골목을 없앤다.
          */}
          <div className="rounded-control bg-surface-3 px-3.5 py-3 text-label text-ink-2">
            <p>이미 가입한 이메일이라면 새 링크가 오지 않습니다.</p>
            <Link
              to="/login"
              className="mt-1.5 inline-block font-medium text-ink underline"
            >
              로그인하러 가기 →
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="회원가입"
      footer={
        <span className="text-ink-2">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-medium text-ink underline">
            로그인
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
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={`${MIN_PASSWORD}자 이상`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="닉네임"
          required
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />

        <Callout tone="error">{error}</Callout>

        <Button type="submit" loading={busy}>
          가입하기
        </Button>
      </form>
    </AuthLayout>
  )
}
