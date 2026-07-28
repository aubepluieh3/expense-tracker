import { useEffect } from 'react'

/**
 * 모바일에서는 하단 시트, 데스크톱에서는 가운데 카드로 보이는 오버레이.
 *
 * 헤더는 항상 `✕ | 제목 | (액션)` 한 가지 형태다. 이전에는 액션이 있으면
 * ✕ 를 쓰고 없으면 "닫기" 텍스트를 써서, 같은 컴포넌트인데 시트마다 헤더가
 * 달라 보였다.
 */
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
        className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-sheet bg-surface p-5 sm:rounded-sheet"
      >
        <div className="mb-4 grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid size-8 place-items-center justify-self-start rounded-control text-ink-muted transition hover:bg-surface-3 hover:text-ink"
          >
            ✕
          </button>
          <h2 className="text-center text-label font-semibold text-ink">{title}</h2>
          <div className="justify-self-end">{action}</div>
        </div>
        {children}
      </div>
    </div>
  )
}
