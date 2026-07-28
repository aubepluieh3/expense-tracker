import { useMonthSummary } from '@/hooks/useSummary'
import { abbrevAmount, formatAmount } from '@/lib/format'
import type { Month } from '@/lib/month'

/**
 * README 의 "월별 총수입 / 총지출 / 잔액".
 *
 * 라벨은 "남은 금액"이다. "잔액"이라고 쓰면 사용자가 통장 잔고로 읽는다 —
 * 통장에 500만원 있고 이번 달 196만원 남긴 사람이 이 숫자를 보고 혼란스러워한다.
 * 수입·지출을 함께 적어 계산 근거를 보여주면 오해가 사라진다.
 *
 * 세 값을 한 줄에 넣는다. 내역 화면 상단이 8줄까지 늘어나 거래가 4건만 보였는데,
 * 근거는 만 단위로 줄여도 역할을 하므로 줄을 합치는 편이 낫다.
 *
 * 필터를 걸어도 이 값은 변하지 않는다. 필터에 반응하면 "남은 금액"이 의미 없는
 * 숫자가 된다(식비만 걸었는데 남은 금액이 −420,000원).
 */
export function MonthSummary({ month }: { month: Month }) {
  const { data, isPending, isError } = useMonthSummary(month)
  const monthNumber = Number(month.slice(5, 7))

  if (isPending) {
    return (
      <div className="mt-3 border-t border-line pt-3" aria-hidden>
        <div className="h-4 w-full animate-pulse rounded bg-surface-3" />
      </div>
    )
  }

  if (isError || !data) return null

  const positive = data.net >= 0

  return (
    <div className="mt-3 flex items-baseline gap-2 border-t border-line pt-3">
      <span className="shrink-0 text-label text-ink-muted">{monthNumber}월 남은 금액</span>
      <span className="flex-1 truncate text-caption tabular-nums text-ink-muted">
        수입 {abbrevAmount(data.income)} · 지출 {abbrevAmount(data.expense)}
      </span>
      <span
        className={`shrink-0 text-body font-semibold tabular-nums ${
          positive ? 'text-ink' : 'text-danger'
        }`}
      >
        {positive ? '+' : '−'}
        {formatAmount(Math.abs(data.net))}
      </span>
    </div>
  )
}
