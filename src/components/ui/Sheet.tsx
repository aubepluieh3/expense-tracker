import { useEffect } from 'react'

/** 모바일에서는 하단 시트, 데스크톱에서는 가운데 카드로 보이는 오버레이. */
export function Sheet({
  title,
  onClose,
  action,
  children,
}: {
  title: string
  onClose: () => void
  /**
   * 헤더 우측 액션 (저장 버튼 등).
   * 폼 제출 버튼을 헤더에 두는 이유: 하단 고정 버튼은 모바일 키보드에 반드시 가린다.
   */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        {action ? (
          <div className="mb-4 grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
            <button
              onClick={onClose}
              aria-label="닫기"
              className="justify-self-start text-lg text-neutral-500 hover:text-neutral-900"
            >
              ✕
            </button>
            <h2 className="text-center text-base font-semibold text-neutral-900">{title}</h2>
            {action}
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">
              닫기
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
