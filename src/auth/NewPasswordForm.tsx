import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authFailureMessage } from '@/auth/authErrors'
import { MIN_PASSWORD, passwordError } from '@/auth/password'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { PasswordField } from '@/components/ui/TextField'

/**
 * 새 비밀번호를 받아 저장하는 폼.
 *
 * 두 화면이 이걸 통째로 복붙해 갖고 있었다 — 메일 링크로 들어오는
 * routes/ResetPassword.tsx 와 로그인 상태에서 여는 설정의 시트(routes/Settings.tsx).
 * 필드·검증·updateUser 호출·에러 처리·버튼 라벨까지 같았고, 다른 것은 성공한
 * 뒤에 할 일(홈으로 이동 / 시트 닫고 스낵바)과 autoFocus 뿐이었다. 그 둘만
 * 프롭으로 받는다.
 *
 * 감싸는 껍데기는 부모가 그린다. 한쪽은 AuthLayout, 다른 쪽은 Sheet 라서
 * 여기까지 흡수하면 두 화면 중 어느 것도 제대로 맞지 않는다.
 *
 * 현재 비밀번호 재확인은 넣지 않는다. Supabase 는 세션만 있으면 변경해 주고,
 * 재확인을 구현하려면 signInWithPassword 로 한 번 더 검증하는 우회가 필요하다.
 * 비로그인 상태의 재설정은 /forgot-password 가 담당한다.
 */
export function NewPasswordForm({
  autoFocus,
  onDone,
}: {
  autoFocus?: boolean
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const invalid = passwordError(password)
    if (invalid) {
      setError(invalid)
      return
    }

    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (updateError) {
      // 이전에는 updateError.message 를 그대로 올려서 영문 문장이 떴다.
      setError(
        authFailureMessage(
          updateError,
          '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      )
      return
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordField
        label="새 비밀번호"
        autoComplete="new-password"
        required
        autoFocus={autoFocus}
        hint={`${MIN_PASSWORD}자 이상`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Callout tone="error">{error}</Callout>
      <Button type="submit" loading={busy}>
        변경하기
      </Button>
    </form>
  )
}
