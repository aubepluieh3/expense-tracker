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
      <p className="text-[15px] font-medium text-neutral-900">{title}</p>
      {description && <p className="text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-6 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-20 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-neutral-600">불러오지 못했습니다</p>
      <button
        onClick={onRetry}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        다시 시도
      </button>
    </div>
  )
}
