import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <span aria-hidden className="text-3xl">
        {icon}
      </span>
      <p className="text-body font-medium text-ink">{title}</p>
      {description && <p className="text-label text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-6 animate-pulse rounded-full bg-surface-3" />
          <div className="h-4 flex-1 animate-pulse rounded bg-surface-3" />
          <div className="h-4 w-20 animate-pulse rounded bg-surface-3" />
        </div>
      ))}
    </div>
  )
}

/**
 * 목록·차트 로딩 실패.
 *
 * 이전에는 배경 없는 회색 텍스트 + 세 번째 종류의 테두리 버튼이었다.
 * 폼 에러(빨간 박스)와 같은 "에러"인데 생김새가 전혀 달라서, 목록 쪽이
 * 디자인이 안 먹은 것처럼 보였다. Callout 과 Button 으로 통일한다.
 */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Callout tone="error">불러오지 못했습니다</Callout>
      <Button variant="outline" size="inline" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}
