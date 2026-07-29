import { useEffect } from 'react'

export type SnackbarState = {
  message: string
  actionLabel?: string
  onAction?: () => void
  /**
   * 실패 알림. 검정 배경은 "됐다"로 읽히므로 실패에 그대로 쓰면 안 된다 —
   * "삭제하지 못했습니다"가 성공 확인처럼 보인다.
   */
  tone?: 'default' | 'error'
} | null

/**
 * 삭제 직후 실행 취소를 제공한다.
 * 이게 있어서 카테고리 관리 화면에 "삭제된 카테고리" 목록을 두지 않아도 된다.
 *
 * 시트가 이미 닫힌 뒤에 실패한 동작(스낵바의 실행 취소 등)의 알림도 여기로 온다.
 * 그 시점에는 에러를 담을 시트가 없다.
 */
export function Snackbar({
  state,
  onDismiss,
  duration = 5000,
}: {
  state: SnackbarState
  onDismiss: () => void
  duration?: number
}) {
  useEffect(() => {
    if (!state) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [state, onDismiss, duration])

  if (!state) return null

  const isError = state.tone === 'error'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-5">
      <div
        role={isError ? 'alert' : 'status'}
        className={`pointer-events-auto flex w-full max-w-[480px] items-center justify-between gap-4 rounded-control px-4 py-3 text-label text-white shadow-lg ${
          isError ? 'bg-danger' : 'bg-accent'
        }`}
      >
        <span>{state.message}</span>
        {state.actionLabel && (
          <button
            onClick={() => {
              state.onAction?.()
              onDismiss()
            }}
            className="shrink-0 font-medium text-white underline"
          >
            {state.actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
