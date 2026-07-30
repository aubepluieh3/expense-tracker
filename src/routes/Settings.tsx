import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { NewPasswordForm } from '@/auth/NewPasswordForm'
import { Page } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { List, rowClass } from '@/components/ui/List'
import { TextField } from '@/components/ui/TextField'
import { Sheet } from '@/components/ui/Sheet'
import { SubtleButton } from '@/components/ui/Button'
import { Snackbar, type SnackbarState } from '@/components/ui/Snackbar'
import { Callout } from '@/components/ui/Callout'
import { useProfile, useUpdateNickname } from '@/hooks/useProfile'
import { MAX_NICKNAME, nicknameError, normalizeSpaces } from '@/lib/rules'
import { GUIDE_PATH } from '@/lib/links'

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
          {/*
            로딩과 실패를 구분한다.

            예전에는 둘 다 `…` 였다(profile.data?.nickname ?? '…'). 그 글자는
            "불러오는 중" 으로 읽히는데, 조회가 실패하면 그 상태로 멈춘다 —
            재시도 계기가 refetchOnReconnect 와 화면 재진입뿐이고 창 포커스
            갱신은 꺼 두었으므로(lib/queryClient.ts), 그 화면에 머물러 있으면
            아무 일도 일어나지 않는다. 실측으로 8초 동안 요청이 0건이었다.

            즉 실패한 사용자는 기다리고, 기다려도 아무 일이 없고, 탈출 방법인
            "탭을 나갔다 오기" 는 실패했다는 사실을 아는 사람만 할 수 있었다.
            빈도는 낮지만(순간 단절 정도) 빠져나올 길이 없는 상태였다.

            수정 버튼이 값이 온 뒤에야 나타나던 것도 함께 해결된다 — 세 상태가
            모두 같은 높이의 한 줄을 차지하므로 누르려던 자리가 밀리지 않는다.
          */}
          {profile.isPending ? (
            <div className="mt-1 flex h-9 items-center">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-3" aria-hidden />
            </div>
          ) : profile.data ? (
            <div className="mt-1 flex items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-ink">{profile.data.nickname}</p>
              <SubtleButton onClick={() => setNicknameOpen(true)}>수정</SubtleButton>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-ink-muted">불러오지 못했습니다</p>
              <SubtleButton onClick={() => void profile.refetch()}>다시 시도</SubtleButton>
            </div>
          )}
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

        {/*
          설명서. public/ 의 정적 문서라 <Link> 가 아니라 <a> 다 — TextLink 는 라우터 Link 를 감싼다.
          매일 쓰는 사람에게는 한 번 보면 끝인 링크라 본문과 같은 무게를 주지 않는다.
          화면 맨 아래, 회색, caption 크기.
        */}
        <p className="text-center">
          <a
            href={GUIDE_PATH}
            target="_blank"
            rel="noreferrer"
            className="text-caption text-ink-muted underline"
          >
            설명서
          </a>
        </p>
      </div>

      {nicknameOpen && profile.data && (
        <ChangeNicknameSheet
          current={profile.data.nickname}
          onClose={() => setNicknameOpen(false)}
          onDone={() => setSnack({ message: '닉네임을 변경했습니다.' })}
        />
      )}
      {/* 폼은 /reset-password 와 같은 것을 쓴다 (auth/NewPasswordForm.tsx).
          여기서 다른 것은 성공한 뒤에 할 일 — 시트를 닫고 스낵바를 띄운다. */}
      {pwOpen && (
        <Sheet title="비밀번호 변경" onClose={() => setPwOpen(false)}>
          <NewPasswordForm
            autoFocus
            onDone={() => {
              setPwOpen(false)
              setSnack({ message: '비밀번호를 변경했습니다.' })
            }}
          />
        </Sheet>
      )}
      <Snackbar state={snack} onDismiss={() => setSnack(null)} />
    </Page>
  )
}

/**
 * 닉네임 변경. 가입 폼과 같은 규칙을 쓴다 (lib/rules.ts).
 *
 * 이전에는 "같은 규칙을 쓴다" 고 적어 두고 실제로는 복붙이었다 — 이 화면은
 * MAX_NICKNAME 상수를, 가입 화면은 리터럴 20 과 리터럴 문구를 썼다. 한쪽만
 * 고치면 가입은 통과한 값이 수정에서 막힌다.
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

  const trimmed = normalizeSpaces(nickname)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const invalid = nicknameError(trimmed)
    if (invalid) {
      setError(invalid)
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
