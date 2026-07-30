import { rowEmojiClass, rowInteractiveClass } from '@/components/ui/List'
import { formatAmount } from '@/lib/format'
import { dayLabel } from '@/lib/month'
import type { TransactionListItem } from '@/hooks/useTransactions'

/**
 * 날짜 하나에 속한 거래들. 헤더에 그날 소계가 붙는다.
 *
 * 카테고리 맵을 받지 않는다 — 이름·이모지는 거래와 함께 온다(useTransactions 의
 * SELECT). 예전에는 별도 조회한 맵에서 찾았고, 그게 늦거나 실패하면 모든 행이
 * "알 수 없음 · 📦" 이 됐다.
 */
export function DayGroup({
  date,
  items,
  upcoming,
  onSelect,
}: {
  date: string
  items: TransactionListItem[]
  /** 오늘 이후 날짜 */
  upcoming: boolean
  onSelect: (id: string) => void
}) {
  const net = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)

  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between border-b border-line pb-1.5">
        {/*
          컨테이너 왼쪽 선(x=20)에 붙인다.

          한동안 행의 **이름** 열(x=60)에 맞춰 두었다. 이름과는 맞았지만 화면의
          나머지 전부와 어긋났다 — 월급 위젯 라벨·대표 숫자·행 이모지·바로 아래
          구분선이 모두 20 이고 날짜만 60 이라, 날짜 앞에 40px 빈 칸이 생기고
          그 밑의 선은 flush 로 시작했다.

          목록의 왼쪽 끝은 이름이 아니라 이모지다. 이름 열(60)은 아이콘 뒤로 한 단
          들여쓴 2차 열이므로 헤더가 거기 맞을 이유가 없다. 20 하나로 모으면
          화면 전체에 왼쪽 선이 하나가 된다.
        */}
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
          return (
            <li key={t.id}>
              <button onClick={() => onSelect(t.id)} className={rowInteractiveClass}>
                <span aria-hidden className={rowEmojiClass}>
                  {t.categories.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{t.categories.name}</span>
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
