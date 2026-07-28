import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authRedirectTo, supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectTo('/reset-password'),
    })
    setBusy(false)
    // 계정이 없어도 성공으로 처리한다 — 있는지 없는지를 알려주면 계정 열거가 된다.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout
        title="메일을 확인해 주세요"
        description={`해당 계정이 있다면 ${email} 로 재설정 링크를 보냈습니다.`}
        footer={
          <Link to="/login" className="font-medium text-ink underline">
            로그인 화면으로
          </Link>
        }
      >
        <></>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="비밀번호 재설정"
      description="가입할 때 쓴 이메일로 재설정 링크를 보내드립니다."
      footer={
        <Link to="/login" className="text-ink-2 underline">
          로그인 화면으로
        </Link>
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
        <Button type="submit" loading={busy}>
          재설정 메일 받기
        </Button>
      </form>
    </AuthLayout>
  )
}
