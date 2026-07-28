import { rowEmojiClass, rowInteractiveClass } from '@/components/ui/List'
import { formatAmount } from '@/lib/format'
import { dayLabel } from '@/lib/month'
import type { TransactionListItem } from '@/hooks/useTransactions'
import type { Category } from '@/types/database'

/**
 * 날짜 하나에 속한 거래들. 헤더에 그날 소계가 붙는다.
 */
export function DayGroup({
  date,
  items,
  upcoming,
  categoryById,
  onSelect,
}: {
  date: string
  items: TransactionListItem[]
  /** 오늘 이후 날짜 */
  upcoming: boolean
  categoryById: Map<string, Category>
  onSelect: (id: string) => void
}) {
  const net = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)

  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between border-b border-line pb-1.5">
        <h2 className="flex items-center gap-1.5 text-label text-ink-muted">
          {dayLabel(date)}
          {/* 날짜 내림차순이라 미래 거래가 목록 맨 위에 온다. 월급 위젯은 미래 지출을
              "예정 지출"로 따로 뺐는데 목록에서 섞여 있으면 사용자가 오늘 날짜를
              기억해야 "아직 안 나간 돈"임을 알 수 있다. */}
          {upcoming && (
            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-caption text-ink-muted">
              예정
            </span>
          )}
        </h2>
        <span className="text-caption text-ink-muted">
          {net >= 0 ? '+' : '−'}
          {formatAmount(Math.abs(net))}
        </span>
      </div>
      <ul>
        {items.map((t) => {
          const category = categoryById.get(t.category_id)
          return (
            <li key={t.id}>
              <button onClick={() => onSelect(t.id)} className={rowInteractiveClass}>
                <span aria-hidden className={rowEmojiClass}>
                  {category?.emoji ?? '📦'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">
                    {category?.name ?? '알 수 없음'}
                  </span>
                  {t.memo && (
                    <span className="block truncate text-caption text-ink-muted">{t.memo}</span>
                  )}
                </span>
                {/* 지출을 빨갛게 칠하지 않는다. 목록 대부분이 빨개져서 강조가 사라진다. */}
                <span
                  className={`shrink-0 text-body tabular-nums ${
                    t.type === 'income' ? 'text-income' : 'text-ink'
                  }`}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {formatAmount(t.amount)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
