import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { AuthLayout } from '@/components/AuthLayout'
import { Callout } from '@/components/ui/Callout'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/TextField'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'

const MIN_PASSWORD = 8

/**
 * 메일의 재설정 링크로 진입한다.
 * supabase-js 가 URL 의 토큰을 자동으로 처리해 세션을 만들고,
 * AuthProvider 의 onAuthStateChange 가 그걸 받는다. 세션이 있어야 변경이 가능하다.
 */
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <FullScreenSpinner />

  if (!session) {
    return (
      <AuthLayout
        title="링크가 유효하지 않습니다"
        description="재설정 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요."
        footer={
          <Link to="/forgot-password" className="font-medium text-ink underline">
            재설정 메일 다시 받기
          </Link>
        }
      >
        <></>
      </AuthLayout>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD) {
      setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`)
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="새 비밀번호 설정">
      <form onSubmit={onSubmit} className="space-y-4">
        <PasswordField
          label="새 비밀번호"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={`${MIN_PASSWORD}자 이상`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Callout tone="error">{error}</Callout>
        <Button type="submit" loading={busy}>
          변경하기
        </Button>
      </form>
    </AuthLayout>
  )
}
