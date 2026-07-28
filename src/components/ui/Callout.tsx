/**
 * 에러·안내 박스.
 *
 * 이전에는 같은 "에러"가 두 갈래였다 — 폼 에러는 빨간 배경 박스였고,
 * 목록 로딩 실패는 배경 없는 회색 텍스트였다. 그래서 목록 쪽이 "디자인이
 * 안 먹은 것"처럼 보였다. 둘을 하나로 합친다.
 */
export function Callout({
  tone = 'notice',
  children,
}: {
  tone?: 'error' | 'notice'
  children: React.ReactNode
}) {
  if (!children) return null

  const isError = tone === 'error'
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={`rounded-control px-3.5 py-2.5 text-label ${
        isError ? 'bg-danger-soft text-danger' : 'bg-surface-3 text-ink-2'
      }`}
    >
      {children}
    </p>
  )
}
