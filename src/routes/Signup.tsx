import { useState } from 'react'
import { authRedirectTo, supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/AuthLayout'
import { TextLink } from '@/components/ui/TextLink'
import { Callout } from '@/components/ui/Callout'
import { Button } from '@/components/ui/Button'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { authFailureMessage, mailSendFailure } from '@/auth/authErrors'
import { MIN_PASSWORD, passwordError } from '@/auth/password'
import { MAX_NICKNAME, nicknameError, normalizeSpaces } from '@/lib/rules'

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

    const trimmedNickname = normalizeSpaces(nickname)
    const invalidPassword = passwordError(password)
    if (invalidPassword) {
      setError(invalidPassword)
      return
    }
    const invalidNickname = nicknameError(trimmedNickname)
    if (invalidNickname) {
      setError(invalidNickname)
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
      // 이전에는 error.message 를 그대로 올려서 영문 문장이 떴다.
      // 계정 존재 여부를 드러내는 코드는 authFailureMessage 가 매핑하지 않으므로
      // 이 fallback 으로 떨어지고, 열거는 열리지 않는다.
      setError(authFailureMessage(error, '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.'))
      return
    }
    // 이미 가입된 이메일이어도 Supabase 는 성공처럼 응답한다(계정 열거 방지).
    // 응답으로는 구분하지 않고, 아래 "메일 확인" 화면의 안내 문구가 두 경우를 모두 커버한다.
    setSent(true)
  }

  async function resend() {
    setError('')
    setNotice('')
    setBusy(true)
    const { error: sendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authRedirectTo('/') },
    })
    setBusy(false)

    // "이미 가입한 이메일이라면 새 링크가 오지 않습니다" 안내가 계정 상태 쪽을
    // 이미 덮는다. 여기서 알려야 하는 건 rate limit·네트워크 실패뿐이다.
    if (sendError) {
      const message = mailSendFailure(sendError)
      if (message) {
        setError(message)
        return
      }
    }
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
          <Callout tone="error">{error}</Callout>

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
            <TextLink to="/login" className="mt-1.5 inline-block">
              로그인하러 가기 →
            </TextLink>
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
          이미 계정이 있으신가요? <TextLink to="/login">로그인</TextLink>
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
          // minLength 를 걸지 않는다. HTML5 검증이 먼저 발동해서 아래 submit 의
          // 우리 메시지가 절대 안 나오고, 브라우저 기본 툴팁이 앱 디자인과 다르게 뜬다.
          hint={`${MIN_PASSWORD}자 이상`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="닉네임"
          required
          maxLength={MAX_NICKNAME}
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
