import { useState } from 'react'
import { authRedirectTo, supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/AuthLayout'
import { TextLink } from '@/components/ui/TextLink'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { TextField } from '@/components/ui/TextField'
import { mailSendFailure } from '@/auth/authErrors'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectTo('/reset-password'),
    })
    setBusy(false)

    /**
     * 계정이 없어도 성공으로 처리한다 — 있는지 없는지를 알려주면 계정 열거가 된다.
     * Supabase 도 없는 주소에 에러를 주지 않으므로, 여기 도달하는 에러는
     * rate limit·네트워크 같은 계정과 무관한 실패다. 그건 알려야 한다 —
     * 삼키면 사용자가 오지 않을 메일을 기다린다.
     */
    if (sendError) {
      const message = mailSendFailure(sendError)
      if (message) {
        setError(message)
        return
      }
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout
        title="메일을 확인해 주세요"
        description={`해당 계정이 있다면 ${email} 로 재설정 링크를 보냈습니다.`}
        footer={<TextLink to="/login">로그인 화면으로</TextLink>}
      >
        <></>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="비밀번호 재설정"
      description="가입할 때 쓴 이메일로 재설정 링크를 보내드립니다."
      footer={<TextLink to="/login">로그인 화면으로</TextLink>}
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
        <Callout tone="error">{error}</Callout>
        <Button type="submit" loading={busy}>
          재설정 메일 받기
        </Button>
      </form>
    </AuthLayout>
  )
}
