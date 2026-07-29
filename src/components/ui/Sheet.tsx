import { useEffect, useRef } from 'react'

/** 포커스 트랩이 순회할 대상. disabled 는 제외한다 — 저장 중 버튼이 그렇다. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 모바일에서는 하단 시트, 데스크톱에서는 가운데 카드로 보이는 오버레이.
 *
 * 헤더는 항상 `✕ | 제목 | (액션)` 한 가지 형태다. 이전에는 액션이 있으면
 * ✕ 를 쓰고 없으면 "닫기" 텍스트를 써서, 같은 컴포넌트인데 시트마다 헤더가
 * 달라 보였다.
 *
 * aria-modal="true" 를 선언하면서 모달의 실제 동작은 Escape 하나뿐이었다.
 * 선언과 동작이 어긋나면 스크린리더·키보드 사용자에게는 거짓말이 된다:
 * Tab 을 계속 누르면 시트 뒤 하단 탭과 FAB 으로 빠져나갔고, 배경은 스크롤됐고,
 * 닫은 뒤 포커스는 <body> 로 떨어져서 방금 누른 행으로 돌아갈 수 없었다.
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
  const dialogRef = useRef<HTMLDivElement>(null)

  /**
   * Escape + Tab 트랩.
   *
   * onClose 는 호출부에서 대개 인라인 화살표 함수라 매 렌더 새 값이다. 그래서
   * 이 효과는 자주 재등록되는데, 리스너 교체는 값싸므로 문제가 없다.
   * 포커스 이동·스크롤 락은 그럴 수 없어서 아래 빈 deps 효과로 분리했다 —
   * 한 효과에 합치면 렌더마다 포커스를 다시 잡고 되돌려 놓는다.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      // 렌더된 순서가 곧 탭 순서다. 숨겨진 요소는 offsetParent 가 없다.
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !dialog.contains(active)

      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /** 포커스 진입·복원과 배경 스크롤 락. 시트가 열려 있는 동안 한 번만. */
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current

    // autoFocus 가 있는 시트는 React 가 이미 잡았다. 없는 시트는 ✕ 로 들어간다 —
    // 포커스가 시트 밖에 남아 있으면 Tab 한 번에 배경으로 나간다.
    if (dialog && !dialog.contains(document.activeElement)) {
      const target = dialog.querySelector<HTMLElement>(FOCUSABLE)
      ;(target ?? dialog).focus()
    }

    // 모바일에서 시트 위 스와이프가 뒤 목록을 굴리던 것을 막는다.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
      // 시트를 연 버튼으로 되돌린다. 안 하면 포커스가 <body> 로 떨어져서
      // 키보드 사용자는 목록 처음부터 다시 Tab 해야 한다.
      opener?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/*
        배경. button 이 아니라 div 다 — button 이면 헤더의 ✕ 와 함께 "닫기"라는
        이름의 버튼이 접근성 트리에 둘 생긴다. tabIndex={-1} 은 탭 순서에서만
        빼 주고 스크린리더 탐색에서는 빼 주지 않는다. 키보드 경로는 Escape 다.
      */}
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-sheet bg-surface p-5 outline-none sm:rounded-sheet"
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
