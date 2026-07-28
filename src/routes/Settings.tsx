import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Page } from '@/components/AppLayout'
import { Button } from '@/components/ui/Button'
import { List, rowClass } from '@/components/ui/List'
import { PasswordField } from '@/components/ui/TextField'
import { Sheet } from '@/components/ui/Sheet'
import { Snackbar, type SnackbarState } from '@/components/ui/Snackbar'
import { Callout } from '@/components/ui/Callout'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useCategories'

const MIN_PASSWORD = 8

export default function Settings() {
  const { user, signOut } = useAuth()
  const profile = useProfile()
  const [pwOpen, setPwOpen] = useState(false)
  const [snack, setSnack] = useState<SnackbarState>(null)

  return (
    <Page title="설정">
      <div className="space-y-6">
        <div className="text-label">
          <p className="text-ink-muted">닉네임</p>
          <p className="mt-1 text-ink">{profile.data?.nickname ?? '…'}</p>
          <p className="mt-3 text-ink-muted">이메일</p>
          <p className="mt-1 text-ink">{user?.email}</p>
        </div>

        <div className="border-y border-line">
          <List>
            <li>
              <Link to="/settings/categories" className={`${rowClass} text-body text-ink`}>
                <span className="flex-1">카테고리 관리</span>
                <span className="text-ink-muted">›</span>
              </Link>
            </li>
            <li>
              <button onClick={() => setPwOpen(true)} className={`${rowClass} text-body text-ink`}>
                <span className="flex-1">비밀번호 변경</span>
                <span className="text-ink-muted">›</span>
              </button>
            </li>
          </List>
        </div>

        <Button variant="ghost" onClick={() => void signOut()}>
          로그아웃
        </Button>
      </div>

      {pwOpen && (
        <ChangePasswordSheet
          onClose={() => setPwOpen(false)}
          onDone={() => setSnack({ message: '비밀번호를 변경했습니다.' })}
        />
      )}
      <Snackbar state={snack} onDismiss={() => setSnack(null)} />
    </Page>
  )
}

/**
 * 로그인 상태에서의 비밀번호 변경.
 *
 * 현재 비밀번호 재확인은 넣지 않는다. Supabase 는 세션만 있으면 변경해 주고,
 * 재확인을 구현하려면 signInWithPassword 로 한 번 더 검증하는 우회가 필요하다.
 * 비로그인 상태의 재설정은 /forgot-password 가 담당한다.
 */
function ChangePasswordSheet({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
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
    onDone()
    onClose()
  }

  return (
    <Sheet title="비밀번호 변경" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <PasswordField
          label="새 비밀번호"
          autoComplete="new-password"
          required
          autoFocus
          hint={`${MIN_PASSWORD}자 이상`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Callout tone="error">{error}</Callout>
        <Button type="submit" loading={busy}>
          변경하기
        </Button>
      </form>
    </Sheet>
  )
}
