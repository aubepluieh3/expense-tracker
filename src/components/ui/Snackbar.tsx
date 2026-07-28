import { useEffect } from 'react'

export type SnackbarState = {
  message: string
  actionLabel?: string
  onAction?: () => void
} | null

/**
 * 삭제 직후 실행 취소를 제공한다.
 * 이게 있어서 카테고리 관리 화면에 "삭제된 카테고리" 목록을 두지 않아도 된다.
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

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-5">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-[480px] items-center justify-between gap-4 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg"
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
