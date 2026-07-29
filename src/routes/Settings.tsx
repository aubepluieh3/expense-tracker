import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Page } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { List, rowClass } from '@/components/ui/List'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { Sheet } from '@/components/ui/Sheet'
import { SubtleButton } from '@/components/ui/Button'
import { Snackbar, type SnackbarState } from '@/components/ui/Snackbar'
import { Callout } from '@/components/ui/Callout'
import { supabase } from '@/lib/supabase'
import { useProfile, useUpdateNickname } from '@/hooks/useCategories'

const MIN_PASSWORD = 8
const MAX_NICKNAME = 20

export default function Settings() {
  const { user, signOut } = useAuth()
  const profile = useProfile()
  const [pwOpen, setPwOpen] = useState(false)
  const [nicknameOpen, setNicknameOpen] = useState(false)
  const [snack, setSnack] = useState<SnackbarState>(null)

  return (
    <Page title="설정">
      <div className="space-y-6">
        <div className="text-label">
          {/*
            닉네임은 바꿀 수 있는 값이라 수정 버튼을 값 옆에 둔다.
            이메일은 로그인 수단이라 여기서 바꾸지 않는다 — 그래서 버튼이 없다.
            둘을 같은 모양으로 늘어놓으면 왜 하나만 바뀌는지 알 수 없다.
          */}
          <p className="text-ink-muted">닉네임</p>
          <div className="mt-1 flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-ink">{profile.data?.nickname ?? '…'}</p>
            {profile.data && (
              <SubtleButton onClick={() => setNicknameOpen(true)}>수정</SubtleButton>
            )}
          </div>
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

      {nicknameOpen && profile.data && (
        <ChangeNicknameSheet
          current={profile.data.nickname}
          onClose={() => setNicknameOpen(false)}
          onDone={() => setSnack({ message: '닉네임을 변경했습니다.' })}
        />
      )}
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
 * 닉네임 변경. 가입 폼과 같은 규칙(1~20자, 앞뒤 공백 제거)을 쓴다.
 * 규칙이 두 화면에서 갈리면 가입은 통과한 값이 수정에서 막힌다.
 */
function ChangeNicknameSheet({
  current,
  onClose,
  onDone,
}: {
  current: string
  onClose: () => void
  onDone: () => void
}) {
  const [nickname, setNickname] = useState(current)
  const [error, setError] = useState('')
  const update = useUpdateNickname()

  const trimmed = nickname.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (trimmed.length < 1 || trimmed.length > MAX_NICKNAME) {
      setError(`닉네임은 1~${MAX_NICKNAME}자로 입력해 주세요`)
      return
    }
    // 안 바뀐 값으로 왕복하지 않는다. 실패할 일도 없는 요청이라 조용히 닫는다.
    if (trimmed === current) {
      onClose()
      return
    }

    try {
      await update.mutateAsync(trimmed)
    } catch {
      setError('닉네임을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    onDone()
    onClose()
  }

  return (
    <Sheet title="닉네임 변경" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="닉네임"
          required
          autoFocus
          maxLength={MAX_NICKNAME}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <Callout tone="error">{error}</Callout>
        <Button type="submit" loading={update.isPending}>
          변경하기
        </Button>
      </form>
    </Sheet>
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
